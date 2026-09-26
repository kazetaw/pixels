/**
 * api/index.ts — Single Vercel Function catch-all router
 *
 * Routes all /api/* requests internally so we stay within
 * Vercel Hobby plan's 12-function limit.
 *
 * Pattern: METHOD /api/<path>
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors } from './lib/cors.js';

// ── lib imports ───────────────────────────────────────────────────────────────
import {
  readMachines, readRecipes, readStocks, readStockImages,
  insertMachine, updateMachine as dbUpdateMachine, deleteMachine as dbDeleteMachine,
  insertRecipe, updateRecipe as dbUpdateRecipe, deleteRecipe as dbDeleteRecipe,
  writeStocks, writeStockImages, getSupabase,
  readBudgets, upsertBudget,
  readPurchases, insertPurchase,
  readFloorTimers, insertFloorTimer, patchFloorTimer,
} from './lib/db.js';
import { parseTimeToHours } from './lib/time.js';
import { findNameConflict, duplicateNameError, normalizeName } from './lib/names.js';
import { calculate } from './lib/bomCalculator.js';
import type {
  Machine, Recipe, StockMap, StockImageMap,
  TargetItem, PlanRequest, PlanResponse,
  FloorPlanResult, BomTreeNode, RawMaterialEntry, IntermediateSupplyEntry,
} from './lib/types.js';
import { randomUUID } from 'crypto';
import { Readable } from 'stream';

// ── helpers ───────────────────────────────────────────────────────────────────

function enrichMachines(machines: Machine[], recipes: Recipe[]): Machine[] {
  const maxHoursMap = new Map<string, number>();
  for (const recipe of recipes) {
    if (!recipe.time_per_unit || !recipe.machine_id) continue;
    const h = parseTimeToHours(recipe.time_per_unit);
    const current = maxHoursMap.get(recipe.machine_id) ?? 0;
    if (h > current) maxHoursMap.set(recipe.machine_id, h);
  }
  return machines.map((m) => ({ ...m, max_hours_limit: maxHoursMap.get(m.machine_id) ?? 0 }));
}

async function syncNameToUUID(newId: string, name: string, stocks: StockMap): Promise<boolean> {
  const stockKey = Object.keys(stocks).find((key) => normalizeName(key) === normalizeName(name));
  if (!stockKey) return false;
  const db = getSupabase();
  const qty = stocks[stockKey] ?? 0;
  await db.from('stocks').delete().eq('item_id', stockKey);
  await db.from('stocks').upsert({ item_id: newId, quantity: qty }, { onConflict: 'item_id' });
  const recipes = await readRecipes();
  for (const r of recipes) {
    if (!Object.prototype.hasOwnProperty.call(r.ingredients, stockKey)) continue;
    const newIng = { ...r.ingredients };
    const existingQty = newIng[stockKey];
    delete newIng[stockKey];
    newIng[newId] = (newIng[newId] ?? 0) + existingQty;
    await db.from('recipes').update({ ingredients: newIng }).eq('id', r.id);
  }
  return true;
}

// ── multipart parser (for upload-image) ──────────────────────────────────────
async function parseMultipart(req: VercelRequest): Promise<{
  file: Buffer; mimetype: string; fields: Record<string, string>;
}> {
  const Busboy = (await import('busboy')).default;
  return new Promise((resolve, reject) => {
    const bb = Busboy({ headers: req.headers as Record<string, string> });
    let fileBuffer: Buffer | null = null;
    let fileMimetype = 'application/octet-stream';
    const fields: Record<string, string> = {};
    bb.on('file', (_f, stream, info) => {
      fileMimetype = info.mimeType;
      const chunks: Buffer[] = [];
      stream.on('data', (c: Buffer) => chunks.push(c));
      stream.on('end', () => { fileBuffer = Buffer.concat(chunks); });
    });
    bb.on('field', (name, value) => { fields[name] = value; });
    bb.on('finish', () => {
      if (!fileBuffer) return reject(new Error('No file received'));
      resolve({ file: fileBuffer, mimetype: fileMimetype, fields });
    });
    bb.on('error', reject);
    if (Buffer.isBuffer(req.body)) Readable.from(req.body).pipe(bb);
    else if (typeof req.body === 'string') Readable.from(Buffer.from(req.body)).pipe(bb);
    else reject(new Error('Unexpected body type'));
  });
}

function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png',
    'image/gif': 'gif', 'image/webp': 'webp',
  };
  return map[mime] ?? 'bin';
}

// ── plan helpers ──────────────────────────────────────────────────────────────
function toHours(days: number, hours = 0, minutes = 0) { return days * 24 + hours + minutes / 60; }

function buildTree(
  itemId: string, quantity: number,
  recipeMap: Map<string, Recipe>, nameMap: Map<string, string>,
  floorProducesMap: Map<string, number>
): BomTreeNode {
  const recipe = recipeMap.get(itemId);
  const name = nameMap.get(itemId) ?? itemId;
  if (!recipe || Object.keys(recipe.ingredients).length === 0)
    return { item_id: itemId, item_name: name, quantity_needed: quantity, is_raw: true, children: [] };
  return {
    item_id: itemId, item_name: name, quantity_needed: quantity, is_raw: false,
    produced_by_floor: floorProducesMap.get(itemId),
    children: Object.entries(recipe.ingredients).map(
      ([id, qty]) => buildTree(id, qty * quantity, recipeMap, nameMap, floorProducesMap)
    ),
  };
}

function accumulateRaw(node: BomTreeNode, acc: Map<string, { name: string; qty: number }>) {
  if (node.is_raw) {
    const e = acc.get(node.item_id);
    acc.set(node.item_id, { name: node.item_name, qty: (e?.qty ?? 0) + node.quantity_needed });
    return;
  }
  for (const child of node.children) accumulateRaw(child, acc);
}

function accumulateIntermediate(node: BomTreeNode, acc: Map<string, { name: string; needed: number }>) {
  if (!node.is_raw) {
    for (const child of node.children) {
      if (!child.is_raw) {
        const e = acc.get(child.item_id);
        acc.set(child.item_id, { name: child.item_name, needed: (e?.needed ?? 0) + child.quantity_needed });
      }
      accumulateIntermediate(child, acc);
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ══════════════════════════════════════════════════════════════════════════════
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;

  // Strip /api/ prefix and split into segments
  const url = (req.url ?? '').split('?')[0];
  const path = url.replace(/^\/api\/?/, '');   // e.g. "recipes/abc-123"
  const segments = path.split('/').filter(Boolean);
  const method = req.method?.toUpperCase() ?? 'GET';

  // ── GET /api/data ───────────────────────────────────────────────────────────
  if (segments[0] === 'data' && method === 'GET') {
    try {
      const [recipes, machines, stocks, stockImages] = await Promise.all([
        readRecipes(), readMachines(), readStocks(), readStockImages(),
      ]);
      return res.json({ recipes, machines: enrichMachines(machines, recipes), stocks, stockImages });
    } catch (e) { return res.status(500).json({ error: (e as Error).message }); }
  }

  // ── /api/recipes ────────────────────────────────────────────────────────────
  if (segments[0] === 'recipes') {
    const id = segments[1];

    // GET /api/recipes
    if (!id && method === 'GET') {
      try { return res.json(await readRecipes()); }
      catch (e) { return res.status(500).json({ error: (e as Error).message }); }
    }

    // POST /api/recipes
    if (!id && method === 'POST') {
      const body = req.body as Partial<Recipe>;
      if (!body.name?.trim()) return res.status(400).json({ error: 'name is required' });
      try {
        const [recipes, machines, stocks] = await Promise.all([readRecipes(), readMachines(), readStocks()]);
        const conflict = findNameConflict(body.name, { recipes, machines, stocks });
        if (conflict && conflict.type !== 'วัตถุดิบ') return res.status(409).json({ error: duplicateNameError(conflict) });
        const newRecipe = await insertRecipe({
          name: body.name.trim(), machine_id: body.machine_id ?? null,
          time_per_unit: body.time_per_unit ?? null, ingredients: body.ingredients ?? {},
          image: body.image,
        });
        const migrated = await syncNameToUUID(newRecipe.id, newRecipe.name, stocks);
        return res.status(201).json({ ...newRecipe, _synced: migrated });
      } catch (e) { return res.status(500).json({ error: (e as Error).message }); }
    }

    // PUT /api/recipes/:id
    if (id && method === 'PUT') {
      const body = req.body as Partial<Recipe>;
      try {
        const [recipes, machines, stocks] = await Promise.all([readRecipes(), readMachines(), readStocks()]);
        const existing = recipes.find((r) => r.id === id);
        if (!existing) return res.status(404).json({ error: `Recipe "${id}" not found` });
        const newName = (body.name ?? existing.name).trim();
        if (!newName) return res.status(400).json({ error: 'name is required' });
        const conflict = findNameConflict(newName, { recipes, machines, stocks, excludeRecipeId: id });
        if (conflict && conflict.type !== 'วัตถุดิบ') return res.status(409).json({ error: duplicateNameError(conflict) });
        const updated = await dbUpdateRecipe(id, {
          name: newName,
          machine_id: body.machine_id !== undefined ? body.machine_id : existing.machine_id,
          time_per_unit: body.time_per_unit !== undefined ? body.time_per_unit : existing.time_per_unit,
          ingredients: body.ingredients !== undefined ? body.ingredients : existing.ingredients,
          image: body.image !== undefined ? body.image : existing.image,
        });
        let migrated = false;
        if (newName !== existing.name) migrated = await syncNameToUUID(id, existing.name, stocks);
        if (!migrated) migrated = await syncNameToUUID(id, newName, await readStocks());
        return res.json({ ...updated, _synced: migrated });
      } catch (e) { return res.status(500).json({ error: (e as Error).message }); }
    }

    // DELETE /api/recipes/:id
    if (id && method === 'DELETE') {
      try {
        const recipes = await readRecipes();
        if (!recipes.some((r) => r.id === id)) return res.status(404).json({ error: `Recipe "${id}" not found` });
        const [stocks, purchases] = await Promise.all([
          readStocks(),
          getSupabase().from('stock_purchases').select('id').eq('item_id', id).limit(1),
        ]);
        if (purchases.error) throw new Error(purchases.error.message);
        if (recipes.some((r) => r.id !== id && Object.hasOwn(r.ingredients, id)) ||
            Object.hasOwn(stocks, id) || (purchases.data?.length ?? 0) > 0) {
          return res.status(409).json({ error: 'ลบไม่ได้: สินค้านี้ยังมีอยู่ในสูตรอื่น สต็อก หรือประวัติการซื้อ กรุณาแก้ไขสูตรเดิมแทนการลบแล้วสร้างใหม่' });
        }
        await dbDeleteRecipe(id);
        return res.json({ ok: true });
      } catch (e) { return res.status(500).json({ error: (e as Error).message }); }
    }
  }

  // ── /api/machines ────────────────────────────────────────────────────────────
  if (segments[0] === 'machines') {
    const id = segments[1];

    // GET /api/machines
    if (!id && method === 'GET') {
      try {
        const [machines, recipes] = await Promise.all([readMachines(), readRecipes()]);
        return res.json(enrichMachines(machines, recipes));
      } catch (e) { return res.status(500).json({ error: (e as Error).message }); }
    }

    // POST /api/machines
    if (!id && method === 'POST') {
      const body = req.body as Partial<Machine>;
      if (!body.machine_name?.trim()) return res.status(400).json({ error: 'machine_name is required' });
      if (typeof body.floor_number !== 'number' || body.floor_number < 1)
        return res.status(400).json({ error: 'floor_number must be a positive number' });
      try {
        const [machines, recipes, stocks] = await Promise.all([readMachines(), readRecipes(), readStocks()]);
        const conflict = findNameConflict(body.machine_name, { recipes, machines, stocks });
        if (conflict) return res.status(409).json({ error: duplicateNameError(conflict) });
        const newMachine = await insertMachine({
          machine_name: body.machine_name.trim(), floor_number: body.floor_number,
          occupation: body.occupation, image: body.image,
        });
        const [enriched] = enrichMachines([newMachine], recipes);
        return res.status(201).json(enriched);
      } catch (e) { return res.status(500).json({ error: (e as Error).message }); }
    }

    // PUT /api/machines/:id
    if (id && method === 'PUT') {
      const body = req.body as Partial<Machine>;
      try {
        const [machines, recipes, stocks] = await Promise.all([readMachines(), readRecipes(), readStocks()]);
        const existing = machines.find((m) => m.machine_id === id);
        if (!existing) return res.status(404).json({ error: `Machine "${id}" not found` });
        const requestedName = (body.machine_name ?? existing.machine_name).trim();
        if (!requestedName) return res.status(400).json({ error: 'machine_name is required' });
        const conflict = findNameConflict(requestedName, { recipes, machines, stocks, excludeMachineId: id });
        if (conflict) return res.status(409).json({ error: duplicateNameError(conflict) });
        const updated = await dbUpdateMachine(id, {
          machine_name: requestedName,
          floor_number: body.floor_number ?? existing.floor_number,
          occupation: body.occupation !== undefined ? body.occupation : existing.occupation,
          image: body.image !== undefined ? body.image : existing.image,
        });
        const [enriched] = enrichMachines([updated], recipes);
        return res.json(enriched);
      } catch (e) { return res.status(500).json({ error: (e as Error).message }); }
    }

    // DELETE /api/machines/:id
    if (id && method === 'DELETE') {
      try {
        const machines = await readMachines();
        if (!machines.some((m) => m.machine_id === id)) return res.status(404).json({ error: `Machine "${id}" not found` });
        await dbDeleteMachine(id);
        return res.json({ ok: true });
      } catch (e) { return res.status(500).json({ error: (e as Error).message }); }
    }
  }

  // ── POST /api/stocks ─────────────────────────────────────────────────────────
  if (segments[0] === 'stocks' && method === 'POST') {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body))
      return res.status(400).json({ error: 'Request body must be an object' });
    let stockMap: StockMap;
    let imageMap: StockImageMap | undefined;
    if (body.stocks !== undefined) { stockMap = body.stocks; imageMap = body.images; }
    else stockMap = body as StockMap;
    for (const [key, value] of Object.entries(stockMap)) {
      if (typeof value !== 'number') return res.status(400).json({ error: `Invalid value for "${key}"` });
    }
    try {
      const [recipes, machines] = await Promise.all([readRecipes(), readMachines()]);
      const recipeIds = new Set(recipes.map((r) => r.id));
      const rawNames = new Map<string, string>();
      for (const key of Object.keys(stockMap)) {
        if (recipeIds.has(key)) continue;
        const normalized = normalizeName(key);
        if (!normalized) return res.status(400).json({ error: 'ชื่อวัตถุดิบต้องไม่ว่าง' });
        const dup = rawNames.get(normalized);
        if (dup) return res.status(409).json({ error: `ชื่อวัตถุดิบซ้ำ: "${dup}" และ "${key}"` });
        rawNames.set(normalized, key);
        const conflict = findNameConflict(key, { recipes, machines, stocks: {} });
        if (conflict) return res.status(409).json({ error: duplicateNameError(conflict) });
      }
      if (imageMap !== undefined) await Promise.all([writeStocks(stockMap), writeStockImages(imageMap)]);
      else await writeStocks(stockMap);
      return res.json({ ok: true });
    } catch (e) { return res.status(500).json({ error: (e as Error).message }); }
  }

  // ── GET /api/stock-images ─────────────────────────────────────────────────────
  if (segments[0] === 'stock-images' && method === 'GET') {
    try { return res.json(await readStockImages()); }
    catch (e) { return res.status(500).json({ error: (e as Error).message }); }
  }

  // ── POST /api/calculate ──────────────────────────────────────────────────────
  if (segments[0] === 'calculate' && method === 'POST') {
    const body = req.body;
    if (!Array.isArray(body) || body.length === 0)
      return res.status(400).json({ error: 'Request body must be a non-empty array' });
    for (let i = 0; i < body.length; i++) {
      const item = body[i];
      if (typeof item.target_item_id !== 'string' || !item.target_item_id.trim())
        return res.status(400).json({ error: `Item at index ${i} missing target_item_id` });
      if (typeof item.target_quantity !== 'number' || item.target_quantity <= 0)
        return res.status(400).json({ error: `Item at index ${i} must have positive target_quantity` });
    }
    try {
      const [recipes, machines, stocks] = await Promise.all([readRecipes(), readMachines(), readStocks()]);
      const allKnown = new Set<string>();
      for (const r of recipes) { allKnown.add(r.id); for (const k of Object.keys(r.ingredients)) allKnown.add(k); }
      for (const item of body as TargetItem[]) {
        if (!allKnown.has(item.target_item_id))
          return res.status(400).json({ error: `Unknown target_item_id: "${item.target_item_id}"` });
      }
      return res.json(calculate(body as TargetItem[], recipes, machines, stocks));
    } catch (e) { return res.status(500).json({ error: (e as Error).message }); }
  }

  // ── POST /api/plan ───────────────────────────────────────────────────────────
  if (segments[0] === 'plan' && method === 'POST') {
    const body = req.body as PlanRequest;
    if (!body || typeof body.event_days !== 'number' || body.event_days <= 0)
      return res.status(400).json({ error: 'event_days must be a positive number' });
    if (!Array.isArray(body.floor_assignments) || body.floor_assignments.length === 0)
      return res.status(400).json({ error: 'floor_assignments must be a non-empty array' });
    const slotsPerFloor = body.slots_per_floor ?? 12;
    const eventHours = toHours(body.event_days, body.event_hours, body.event_minutes);
    try {
      const [recipes, stocks] = await Promise.all([readRecipes(), readStocks()]);
      const recipeMap = new Map(recipes.map((r) => [r.id, r]));
      const nameMap = new Map(recipes.map((r) => [r.id, r.name]));
      for (const fa of body.floor_assignments) {
        if (!recipeMap.has(fa.recipe_id))
          return res.status(400).json({ error: `Unknown recipe_id "${fa.recipe_id}"` });
      }
      const floorProducesMap = new Map<string, number>();
      for (const fa of body.floor_assignments) {
        if (!floorProducesMap.has(fa.recipe_id)) floorProducesMap.set(fa.recipe_id, fa.floor_number);
      }
      const floorResults: FloorPlanResult[] = body.floor_assignments.map((fa) => {
        const recipe = recipeMap.get(fa.recipe_id)!;
        const tph = parseTimeToHours(recipe.time_per_unit);
        const cycles = tph > 0 ? Math.floor(eventHours / tph) : 0;
        const outputQty = cycles * slotsPerFloor;
        return {
          floor_number: fa.floor_number, recipe_id: recipe.id, recipe_name: recipe.name,
          time_per_unit: recipe.time_per_unit ?? '00:00:00', cycles, output_qty: outputQty,
          bom_tree: buildTree(recipe.id, outputQty, recipeMap, nameMap, floorProducesMap),
        };
      });
      const rawAcc = new Map<string, { name: string; qty: number }>();
      for (const fr of floorResults) accumulateRaw(fr.bom_tree, rawAcc);
      const raw_materials: RawMaterialEntry[] = Array.from(rawAcc.entries()).map(([itemId, { name, qty }]) => {
        const inStock = (stocks as StockMap)[itemId] ?? 0;
        return { item_id: itemId, item_name: name, total_needed: qty, in_stock: inStock, net_required: Math.max(0, qty - inStock), sufficient: inStock >= qty };
      }).sort((a, b) => { if (a.sufficient !== b.sufficient) return a.sufficient ? 1 : -1; return b.total_needed - a.total_needed; });
      const interNeeded = new Map<string, { name: string; needed: number }>();
      for (const fr of floorResults) accumulateIntermediate(fr.bom_tree, interNeeded);
      const interProduced = new Map<string, number>();
      for (const fr of floorResults) interProduced.set(fr.recipe_id, (interProduced.get(fr.recipe_id) ?? 0) + fr.output_qty);
      const intermediate_supply: IntermediateSupplyEntry[] = Array.from(interNeeded.entries()).map(([itemId, { name, needed }]) => {
        const produced = interProduced.get(itemId) ?? 0;
        return { item_id: itemId, item_name: name, needed, produced, sufficient: produced >= needed, shortfall: Math.max(0, needed - produced) };
      }).sort((a, b) => { if (a.sufficient !== b.sufficient) return a.sufficient ? 1 : -1; return b.shortfall - a.shortfall; });
      const response: PlanResponse = { event_total_hours: eventHours, floor_results: floorResults, intermediate_supply, raw_materials };
      return res.json(response);
    } catch (e) { return res.status(500).json({ error: (e as Error).message }); }
  }

  // ── GET /api/diagnose ────────────────────────────────────────────────────────
  if (segments[0] === 'diagnose' && method === 'GET') {
    try {
      const [recipes, stocks] = await Promise.all([readRecipes(), readStocks()]);
      const nameToId = new Map(recipes.map((r) => [r.name.trim(), r.id]));
      const conflicts: object[] = [];
      for (const [key, qty] of Object.entries(stocks)) {
        const uuid = nameToId.get(key);
        if (uuid && uuid !== key) conflicts.push({ type: 'stock_key', description: `สต็อก "${key}" ควรใช้ UUID`, currentKey: key, targetUUID: uuid, recipeName: 'สต็อก', currentQty: qty });
      }
      for (const recipe of recipes) {
        for (const [key, qty] of Object.entries(recipe.ingredients)) {
          const uuid = nameToId.get(key);
          if (uuid && uuid !== key) conflicts.push({ type: 'ingredient_ref', description: `Recipe "${recipe.name}" → ingredient "${key}" ควรใช้ UUID`, currentKey: key, targetUUID: uuid, recipeName: recipe.name, currentQty: qty });
        }
      }
      return res.json({ conflicts, totalConflicts: conflicts.length, isClean: conflicts.length === 0 });
    } catch (e) { return res.status(500).json({ error: (e as Error).message }); }
  }

  // ── POST /api/migrate ────────────────────────────────────────────────────────
  if (segments[0] === 'migrate' && method === 'POST') {
    try {
      const [recipes, stocks] = await Promise.all([readRecipes(), readStocks()]);
      const db = getSupabase();
      const nameToId = new Map(recipes.map((r) => [r.name.trim(), r.id]));
      const stocksFixed: string[] = [];
      const ingredientsFixed: string[] = [];
      for (const [key, qty] of Object.entries(stocks)) {
        const uuid = nameToId.get(key);
        if (uuid && uuid !== key) {
          await db.from('stocks').delete().eq('item_id', key);
          await db.from('stocks').upsert({ item_id: uuid, quantity: qty }, { onConflict: 'item_id' });
          stocksFixed.push(key);
        }
      }
      for (const recipe of recipes) {
        let changed = false;
        const newIng: Record<string, number> = {};
        for (const [key, qty] of Object.entries(recipe.ingredients)) {
          const uuid = nameToId.get(key);
          if (uuid && uuid !== key) { newIng[uuid] = (newIng[uuid] ?? 0) + qty; ingredientsFixed.push(`${recipe.name} → "${key}"`); changed = true; }
          else newIng[key] = (newIng[key] ?? 0) + qty;
        }
        if (changed) await db.from('recipes').update({ ingredients: newIng }).eq('id', recipe.id);
      }
      const totalChanges = stocksFixed.length + ingredientsFixed.length;
      return res.json({ ok: true, message: totalChanges > 0 ? `แก้ไข ${stocksFixed.length} stock keys และ ${ingredientsFixed.length} ingredient refs` : 'ไม่พบ conflict', report: { stocksFixed, ingredientsFixed, totalChanges } });
    } catch (e) { return res.status(500).json({ error: (e as Error).message }); }
  }

  // ── POST /api/upload-image ───────────────────────────────────────────────────
  if (segments[0] === 'upload-image' && method === 'POST') {
    try {
      const { file, mimetype, fields } = await parseMultipart(req);
      const bucket = fields.bucket ?? 'images';
      const folder = fields.folder ?? 'misc';
      const itemId = fields.itemId ?? randomUUID();
      const ext = extFromMime(mimetype);
      const storagePath = `${folder}/${itemId}.${ext}`;
      const db = getSupabase();
      const { error: uploadErr } = await db.storage.from(bucket).upload(storagePath, file, { contentType: mimetype, upsert: true });
      if (uploadErr) return res.status(500).json({ error: uploadErr.message });
      const { data: urlData } = db.storage.from(bucket).getPublicUrl(storagePath);
      return res.json({ url: urlData.publicUrl, path: storagePath });
    } catch (e) { return res.status(500).json({ error: (e as Error).message }); }
  }

  // ── /api/budgets ─────────────────────────────────────────────────────────────
  if (segments[0] === 'budgets') {
    // GET /api/budgets — return budgets + last 100 purchases
    if (method === 'GET') {
      try {
        const [budgets, purchases] = await Promise.all([readBudgets(), readPurchases()]);
        return res.json({ budgets, purchases });
      } catch (e) { return res.status(500).json({ error: (e as Error).message }); }
    }
    // PUT /api/budgets — upsert one budget limit
    if (method === 'PUT') {
      const body = req.body as { currency: 'THB' | 'G'; limit_amount: number };
      if (!body.currency || !['THB','G'].includes(body.currency))
        return res.status(400).json({ error: 'currency must be THB or G' });
      if (typeof body.limit_amount !== 'number' || body.limit_amount < 0)
        return res.status(400).json({ error: 'limit_amount must be a non-negative number' });
      try {
        const budget = await upsertBudget(body.currency, body.limit_amount);
        return res.json(budget);
      } catch (e) { return res.status(500).json({ error: (e as Error).message }); }
    }
  }

  // ── /api/purchases ────────────────────────────────────────────────────────────
  if (segments[0] === 'purchases') {
    // GET /api/purchases
    if (method === 'GET') {
      try { return res.json(await readPurchases()); }
      catch (e) { return res.status(500).json({ error: (e as Error).message }); }
    }
    // POST /api/purchases — log a purchase and increment stock
    if (method === 'POST') {
      const body = req.body as {
        item_id: string; quantity: number; total_amount: number;
        currency: 'THB' | 'G'; source?: string; contributor?: string;
      };
      if (!body.item_id?.trim()) return res.status(400).json({ error: 'item_id is required' });
      if (typeof body.quantity !== 'number' || body.quantity <= 0)
        return res.status(400).json({ error: 'quantity must be positive' });
      if (!['THB','G'].includes(body.currency))
        return res.status(400).json({ error: 'currency must be THB or G' });
      try {
        const purchase = await insertPurchase({
          item_id: body.item_id.trim(),
          quantity: body.quantity,
          total_amount: body.total_amount ?? 0,
          currency: body.currency,
          source: body.source ?? null,
          contributor: body.contributor ?? null,
        });
        return res.status(201).json(purchase);
      } catch (e) { return res.status(500).json({ error: (e as Error).message }); }
    }
  }

  // ── /api/floors ───────────────────────────────────────────────────────────────
  if (segments[0] === 'floors') {
    const floorNum = segments[1] ? parseInt(segments[1], 10) : NaN;

    // GET /api/floors
    if (!segments[1] && method === 'GET') {
      try { return res.json(await readFloorTimers()); }
      catch (e) { return res.status(500).json({ error: (e as Error).message }); }
    }

    // POST /api/floors — add new floor
    if (!segments[1] && method === 'POST') {
      const body = req.body as { floor_number: number; profession?: string };
      if (typeof body.floor_number !== 'number' || body.floor_number < 1)
        return res.status(400).json({ error: 'floor_number must be a positive integer' });
      try {
        const floor = await insertFloorTimer(body.floor_number, body.profession);
        return res.status(201).json(floor);
      } catch (e) { return res.status(500).json({ error: (e as Error).message }); }
    }

    // PATCH /api/floors/:number — update timer state
    if (segments[1] && method === 'PATCH') {
      if (isNaN(floorNum)) return res.status(400).json({ error: 'Invalid floor number' });
      try {
        const patch = req.body as Record<string, unknown>;
        const updated = await patchFloorTimer(floorNum, patch);
        return res.json(updated);
      } catch (e) { return res.status(500).json({ error: (e as Error).message }); }
    }
  }

  // ── 404 ──────────────────────────────────────────────────────────────────────
  return res.status(404).json({ error: `Route not found: ${method} /api/${path}` });
}

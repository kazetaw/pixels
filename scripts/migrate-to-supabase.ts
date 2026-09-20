#!/usr/bin/env tsx
/**
 * scripts/migrate-to-supabase.ts
 *
 * One-shot migration: reads all JSON data files, uploads images to Supabase
 * Storage, and inserts rows into Supabase tables.
 *
 * Usage:
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   npx tsx scripts/migrate-to-supabase.ts
 *
 * Run ONCE on a fresh Supabase project after running supabase/schema.sql.
 * Safe to re-run — uses upsert so existing rows are overwritten.
 */

import { createClient } from '@supabase/supabase-js';
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

// ── env ───────────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌  Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// ── paths ─────────────────────────────────────────────────────────────────────
const DATA_DIR        = path.resolve(process.cwd(), 'backend/data');
const MACHINES_JSON   = path.join(DATA_DIR, 'machines.json');
const RECIPES_JSON    = path.join(DATA_DIR, 'recipes.json');
const STOCKS_JSON     = path.join(DATA_DIR, 'stocks.json');
const STOCK_IMG_JSON  = path.join(DATA_DIR, 'stock_images.json');
const BUCKET          = 'images';

// ── helpers ───────────────────────────────────────────────────────────────────

/** Convert a base64 data URI to a Buffer + mime type */
function dataUriToBuffer(dataUri: string): { buffer: Buffer; mime: string; ext: string } {
  const [header, b64] = dataUri.split(',');
  const mime = header.replace('data:', '').replace(';base64', '');
  const extMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg':  'jpg',
    'image/png':  'png',
    'image/gif':  'gif',
    'image/webp': 'webp',
  };
  const ext = extMap[mime] ?? 'bin';
  return { buffer: Buffer.from(b64, 'base64'), mime, ext };
}

/** Upload a buffer to Supabase Storage, return public URL */
async function uploadBuffer(
  buffer: Buffer,
  mime: string,
  storagePath: string
): Promise<string> {
  const { error } = await db.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: mime, upsert: true });
  if (error) throw new Error(`Storage upload failed (${storagePath}): ${error.message}`);
  const { data } = db.storage.from(BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

/** Upload image from a base64 data URI (or return undefined if null/undefined) */
async function uploadFromBase64(
  dataUri: string | undefined | null,
  storagePath: string
): Promise<string | undefined> {
  if (!dataUri || !dataUri.startsWith('data:')) return dataUri ?? undefined;
  const { buffer, mime } = dataUriToBuffer(dataUri);
  return uploadBuffer(buffer, mime, storagePath);
}

// ── ensure bucket exists ───────────────────────────────────────────────────────
async function ensureBucket() {
  const { data: buckets } = await db.storage.listBuckets();
  const exists = buckets?.some((b) => b.name === BUCKET);
  if (!exists) {
    const { error } = await db.storage.createBucket(BUCKET, { public: true });
    if (error) throw new Error(`Could not create bucket "${BUCKET}": ${error.message}`);
    console.log(`✅  Created storage bucket "${BUCKET}"`);
  } else {
    console.log(`ℹ️   Bucket "${BUCKET}" already exists`);
  }
}

// ── interfaces (mirrors backend types) ────────────────────────────────────────
interface MachineRow {
  machine_id: string;
  machine_name: string;
  floor_number: number;
  occupation?: string;
  image?: string;
}

interface RecipeRow {
  id: string;
  name: string;
  machine_id: string | null;
  time_per_unit: string | null;
  ingredients: Record<string, number>;
  image?: string;
}

// ── migrate machines ──────────────────────────────────────────────────────────
async function migrateMachines() {
  console.log('\n📦  Migrating machines…');
  const raw = await fs.readFile(MACHINES_JSON, 'utf-8');
  const machines: MachineRow[] = JSON.parse(raw);
  let uploaded = 0;

  for (const m of machines) {
    process.stdout.write(`  ${m.machine_name}… `);
    let imageUrl: string | undefined;

    if (m.image) {
      try {
        const ext = m.image.startsWith('data:image/jpeg') ? 'jpg' : 'png';
        imageUrl = await uploadFromBase64(m.image, `machines/${m.machine_id}.${ext}`);
        uploaded++;
      } catch (e) {
        console.warn(`⚠️  image upload failed: ${(e as Error).message}`);
      }
    }

    const { error } = await db.from('machines').upsert({
      machine_id:   m.machine_id,
      machine_name: m.machine_name,
      floor_number: m.floor_number,
      occupation:   m.occupation ?? null,
      image_url:    imageUrl ?? null,
    }, { onConflict: 'machine_id' });

    if (error) {
      console.error(`❌  ${m.machine_name}: ${error.message}`);
    } else {
      console.log('✓');
    }
  }

  console.log(`  → ${machines.length} machines inserted, ${uploaded} images uploaded`);
}

// ── migrate recipes ───────────────────────────────────────────────────────────
async function migrateRecipes() {
  console.log('\n🍫  Migrating recipes…');
  const raw = await fs.readFile(RECIPES_JSON, 'utf-8');
  const recipes: RecipeRow[] = JSON.parse(raw);

  // Get valid machine_ids already in DB
  const { data: machineRows } = await db.from('machines').select('machine_id');
  const validMachineIds = new Set((machineRows ?? []).map((m) => m.machine_id));

  let uploaded = 0;
  let skipped = 0;

  for (const r of recipes) {
    process.stdout.write(`  ${r.name}… `);

    // If machine_id doesn't exist in machines table, set to null to avoid FK error
    const safeMachineId = r.machine_id && validMachineIds.has(r.machine_id)
      ? r.machine_id
      : null;

    if (r.machine_id && !validMachineIds.has(r.machine_id)) {
      process.stdout.write(`(machine_id not found — set null) `);
      skipped++;
    }

    let imageUrl: string | undefined;
    if (r.image) {
      try {
        imageUrl = await uploadFromBase64(r.image, `recipes/${r.id}.png`);
        uploaded++;
      } catch (e) {
        console.warn(`⚠️  image upload failed: ${(e as Error).message}`);
      }
    }

    const { error } = await db.from('recipes').upsert({
      id:            r.id,
      name:          r.name,
      machine_id:    safeMachineId,
      time_per_unit: r.time_per_unit ?? null,
      ingredients:   r.ingredients,
      image_url:     imageUrl ?? null,
    }, { onConflict: 'id' });

    if (error) {
      console.error(`❌  ${r.name}: ${error.message}`);
    } else {
      console.log('✓');
    }
  }

  console.log(`  → ${recipes.length} recipes processed, ${uploaded} images uploaded, ${skipped} machine_ids set to null`);
}

// ── migrate stocks ────────────────────────────────────────────────────────────
async function migrateStocks() {
  console.log('\n📊  Migrating stocks…');
  const raw = await fs.readFile(STOCKS_JSON, 'utf-8');
  const stocks: Record<string, number> = JSON.parse(raw);
  const rows = Object.entries(stocks).map(([item_id, quantity]) => ({ item_id, quantity }));

  const { error } = await db.from('stocks').upsert(rows, { onConflict: 'item_id' });
  if (error) throw new Error(`stocks upsert failed: ${error.message}`);
  console.log(`  → ${rows.length} stock entries inserted`);
}

// ── migrate stock images ──────────────────────────────────────────────────────
async function migrateStockImages() {
  console.log('\n🖼️   Migrating stock images…');
  let raw: string;
  try {
    raw = await fs.readFile(STOCK_IMG_JSON, 'utf-8');
  } catch {
    console.log('  ℹ️  stock_images.json not found — skipping');
    return;
  }

  const images: Record<string, string> = JSON.parse(raw);
  let uploaded = 0;

  for (const [itemId, dataUri] of Object.entries(images)) {
    process.stdout.write(`  ${itemId}… `);
    let imageUrl: string;
    try {
      // Use UUID only as filename — avoid Thai chars in storage path
      const fileUuid = randomUUID();
      imageUrl = await uploadFromBase64(dataUri, `stocks/${fileUuid}.png`) ?? dataUri;
      uploaded++;

      const { error } = await db.from('stock_images').upsert(
        { item_id: itemId, image_url: imageUrl },
        { onConflict: 'item_id' }
      );
      if (error) {
        console.error(`❌  ${itemId}: ${error.message}`);
      } else {
        console.log('✓');
      }
    } catch (e) {
      console.warn(`⚠️  ${itemId}: ${(e as Error).message}`);
    }
  }

  console.log(`  → ${Object.keys(images).length} stock images processed, ${uploaded} uploaded`);
}

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🚀  Starting migration to Supabase…');
  console.log(`    URL: ${SUPABASE_URL}`);

  await ensureBucket();
  await migrateMachines();
  await migrateRecipes();
  await migrateStocks();
  await migrateStockImages();

  console.log('\n✅  Migration complete!');
}

main().catch((err) => {
  console.error('\n❌  Migration failed:', err);
  process.exit(1);
});

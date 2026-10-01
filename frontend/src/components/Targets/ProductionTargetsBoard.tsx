import { Alert, Button, Empty, Spin, Tag } from 'antd';
import { DownOutlined, ReloadOutlined, RightOutlined } from '@ant-design/icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchSharedPlannerPlan, runPlan } from '../../api/client';
import type { BomTreeNode, Machine, PlanRequest, PlanResponse, Recipe, StockMap } from '../../types';
import { ItemLabel } from '../shared/ItemVisual';

interface ProductionTargetsBoardProps {
  recipes: Recipe[];
  machines: Machine[];
  stocks: StockMap;
  itemNames?: Record<string, string>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function resolveName(
  id: string,
  nodeItemName: string,
  nameMap: Map<string, string>
): string {
  // prefer nameMap (recipes + catalog); fall back to node name only if it isn't a UUID
  const mapped = nameMap.get(id);
  if (mapped) return mapped;
  if (!UUID_RE.test(nodeItemName)) return nodeItemName;
  return '(ไม่ระบุชื่อ)';
}

function formatNumber(value: number) { return value.toLocaleString('th-TH'); }

interface MaterialNeed {
  id: string;
  name: string;
  quantity: number;
  children: Map<string, MaterialNeed>;
}

interface DisplayMaterialNeed extends Omit<MaterialNeed, 'children'> {
  children: DisplayMaterialNeed[];
}

function addMaterialNeed(
  materials: Map<string, MaterialNeed>,
  node: BomTreeNode,
  nameMap: Map<string, string>
) {
  const current = materials.get(node.item_id) ?? {
    id: node.item_id,
    name: resolveName(node.item_id, node.item_name, nameMap),
    quantity: 0,
    children: new Map<string, MaterialNeed>(),
  };
  current.quantity += node.quantity_needed;
  materials.set(node.item_id, current);
  for (const child of node.children) addMaterialNeed(current.children, child, nameMap);
}

function collectDirectIngredients(node: BomTreeNode, materials: Map<string, MaterialNeed>, nameMap: Map<string, string>) {
  // Each direct ingredient stays at the top level. Its full BOM is kept as
  // nested children so users can expand only the product they need to inspect.
  for (const child of node.children) addMaterialNeed(materials, child, nameMap);
}

function displayMaterialNeeds(materials: Map<string, MaterialNeed>): DisplayMaterialNeed[] {
  return Array.from(materials.values())
    .map(({ children, ...material }) => ({ ...material, children: displayMaterialNeeds(children) }))
    .sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name, 'th'));
}

function MaterialNeedRow({ material, stocks, depth = 0 }: { material: DisplayMaterialNeed; stocks: StockMap; depth?: number }) {
  const [open, setOpen] = useState(false);
  const hasChildren = material.children.length > 0;
  const inStock = stocks[material.id] ?? 0;
  const isSufficient = inStock >= material.quantity;

  return <div>
    <div className="production-targets__material" style={depth ? { background: '#fafcff' } : undefined}>
      <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, flex: 1 }}>
        {hasChildren ? <Button type="text" size="small" onClick={() => setOpen((value) => !value)} icon={open ? <DownOutlined /> : <RightOutlined />} aria-label={`${open ? 'ย่อ' : 'ขยาย'}วัตถุดิบของ ${material.name}`} style={{ marginLeft: -8, marginRight: 2 }} /> : <span style={{ width: 20 }} />}
        <ItemLabel id={material.id} name={material.name} size={depth ? 22 : 26} reserveImage />
      </div>
      <span className="production-targets__material-stock" style={{ color: isSufficient ? '#16a34a' : '#dc2626', fontVariantNumeric: 'tabular-nums' }}>
        {formatNumber(inStock)}<span style={{ color: '#94a3b8', margin: '0 2px' }}>/</span><strong>{formatNumber(material.quantity)}</strong>
      </span>
      <span style={{ color: '#64748b', fontSize: 12, whiteSpace: 'nowrap' }}>{Math.ceil(material.quantity / 99)} กอง</span>
    </div>
    {hasChildren && open && <div className="material-children">{material.children.map((child) => <MaterialNeedRow key={child.id} material={child} stocks={stocks} depth={depth + 1} />)}</div>}
  </div>;
}

export function ProductionTargetsBoard({ recipes, machines, stocks, itemNames = {} }: ProductionTargetsBoardProps) {
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const sharedPlan = await fetchSharedPlannerPlan();
      if (!sharedPlan || !sharedPlan.floors.length) { setPlan(null); setLoading(false); return; }
      const assignedFloors = sharedPlan.floors.filter((floor) => floor.recipe_id);
      if (!assignedFloors.length) { setPlan(null); setLoading(false); return; }
      const request: PlanRequest = {
        event_days: sharedPlan.event_days,
        event_hours: sharedPlan.event_hours,
        event_minutes: sharedPlan.event_minutes,
        slots_per_floor: 12,
        floor_assignments: assignedFloors.map(({ floor_number, recipe_id }) => ({ floor_number, recipe_id })),
      };
      setPlan(await runPlan(request));
    } catch (err) { setError((err as Error).message || 'คำนวณเป้าหมายการผลิตไม่สำเร็จ'); setPlan(null); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const boards = useMemo(() => {
    // Build a name map: catalog names first, then recipe names overwrite
    const nameMap = new Map<string, string>(
      Object.entries(itemNames).filter(([, n]) => !UUID_RE.test(n))
    );
    for (const r of recipes) nameMap.set(r.id, r.name);

    const grouped = new Map<string, { floors: number[]; products: Map<string, number>; materials: Map<string, MaterialNeed> }>();
    for (const result of plan?.floor_results ?? []) {
      const recipe = recipes.find((item) => item.id === result.recipe_id);
      if (!recipe?.machine_id) continue;
      const current = grouped.get(recipe.machine_id) ?? { floors: [], products: new Map<string, number>(), materials: new Map<string, MaterialNeed>() };
      current.floors.push(result.floor_number);
      current.products.set(recipe.id, (current.products.get(recipe.id) ?? 0) + result.output_qty);
      if (!result.bom_tree.is_raw) collectDirectIngredients(result.bom_tree, current.materials, nameMap);
      grouped.set(recipe.machine_id, current);
    }
    return Array.from(grouped, ([machineId, group]) => ({
      machineId,
      machine: machines.find((item) => item.machine_id === machineId),
      floors: group.floors.sort((a, b) => a - b),
      products: Array.from(group.products, ([recipeId, target]) => ({ recipe: recipes.find((item) => item.id === recipeId)!, target }))
        .filter((product) => !!product.recipe)
        .sort((a, b) => a.recipe.name.localeCompare(b.recipe.name, 'th')),
      materials: displayMaterialNeeds(group.materials),
    })).sort((a, b) => (a.machine?.machine_name ?? a.machineId).localeCompare(b.machine?.machine_name ?? b.machineId, 'th'));
  }, [machines, plan, recipes, itemNames]);

  const itemCount = boards.reduce((sum, board) => sum + board.products.length, 0);
  const targetTotal = boards.flatMap((board) => board.products).reduce((sum, product) => sum + product.target, 0);

  return <div className="production-targets">
    {error && <Alert type="error" showIcon message="คำนวณเป้าหมายการผลิตไม่สำเร็จ" description={error} action={<Button size="small" onClick={() => void load()}>ลองอีกครั้ง</Button>} />}
    <section className="production-targets__summary">
      <div><span>เครื่องในแผน</span><strong>{boards.length}</strong></div>
      <div><span>สินค้าเป้าหมาย</span><strong>{itemCount}</strong></div>
      <div><span>เป้าหมายผลิตรวม</span><strong>{formatNumber(targetTotal)}</strong></div>
      <p>Target คำนวณจากชั้น สูตร และระยะเวลา Event ในแผนการผลิตส่วนกลาง <Button type="link" size="small" icon={<ReloadOutlined />} onClick={() => void load()}>คำนวณใหม่</Button></p>
    </section>

    {loading ? <div className="production-targets__loading"><Spin /><span>กำลังคำนวณเป้าหมายจากแผนการผลิตส่วนกลาง…</span></div> : boards.length === 0 ? (
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="ยังไม่มีสูตรที่เลือกในแผนการผลิตส่วนกลาง" />
    ) : <div className="production-targets__grid">
      {boards.map(({ machineId, machine, floors, products, materials }) => <section className="production-targets__floor" key={machineId}>
        <header><div><span className="production-targets__floor-number">ชั้น {floors.join(', ')}</span><h3><ItemLabel id={machineId} name={machine?.machine_name ?? 'ไม่พบเครื่องจักร'} image={machine?.image} size={30} reserveImage /></h3></div><Tag color="blue">รวม {floors.length} ชั้น</Tag></header>
        <div className="production-targets__items">
          <h4>ผลิตตามแผน</h4>
          {products.map(({ recipe, target }) => {
            const inStock = stocks[recipe.id] ?? 0;
            const remaining = Math.max(0, target - inStock);
            const progress = Math.min(100, Math.round((inStock / target) * 100));
            const done = inStock >= target;
            return <div className="production-targets__item" key={recipe.id}>
              <div className="production-targets__item-name"><ItemLabel id={recipe.id} name={recipe.name} image={recipe.image} size={38} reserveImage /></div>
              <div className="production-targets__counts">
                <span>มี <b>{formatNumber(inStock)}</b></span>
                <span>/</span>
                <strong>{formatNumber(target)}</strong>
                {done
                  ? <span style={{ color: '#16a34a', fontSize: 12, fontWeight: 600 }}>✓ ครบแล้ว</span>
                  : <span style={{ color: '#dc2626', fontSize: 12 }}>เหลืออีก <b>{formatNumber(remaining)}</b></span>}
              </div>
              <div className="production-targets__progress" aria-label={`มี ${inStock} จากเป้าหมาย ${target}`}><div className="production-targets__progress-track"><i className={done ? 'is-complete' : ''} style={{ width: `${progress}%` }} /></div><span>{progress}%</span></div>
            </div>;
          })}
        </div>
        <section className="production-targets__materials">
          <div className="production-targets__materials-heading"><h4>ต้องเตรียมวัตถุดิบ</h4><span>สต็อก / ต้องการ · กอง (÷99)</span></div>
          {materials.length === 0 ? <p className="production-targets__materials-empty">สูตรในเครื่องนี้ไม่มีวัตถุดิบที่ต้องเตรียมเพิ่ม</p> : materials.map((material) => <MaterialNeedRow key={material.id} material={material} stocks={stocks} />)}
        </section>
      </section>)}
    </div>}
  </div>;
}

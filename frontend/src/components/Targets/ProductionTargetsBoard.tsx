import { Alert, Button, Empty, Spin, Tag } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
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

function collectRawMaterials(
  node: BomTreeNode,
  materials: Map<string, { name: string; quantity: number }>,
  nameMap: Map<string, string>
) {
  if (node.is_raw) {
    const current = materials.get(node.item_id);
    const name = resolveName(node.item_id, node.item_name, nameMap);
    materials.set(node.item_id, { name, quantity: (current?.quantity ?? 0) + node.quantity_needed });
    return;
  }
  for (const child of node.children) collectRawMaterials(child, materials, nameMap);
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

    const grouped = new Map<string, { floors: number[]; products: Map<string, number>; materials: Map<string, { name: string; quantity: number }> }>();
    for (const result of plan?.floor_results ?? []) {
      const recipe = recipes.find((item) => item.id === result.recipe_id);
      if (!recipe?.machine_id) continue;
      const current = grouped.get(recipe.machine_id) ?? { floors: [], products: new Map<string, number>(), materials: new Map<string, { name: string; quantity: number }>() };
      current.floors.push(result.floor_number);
      current.products.set(recipe.id, (current.products.get(recipe.id) ?? 0) + result.output_qty);
      if (!result.bom_tree.is_raw) collectRawMaterials(result.bom_tree, current.materials, nameMap);
      grouped.set(recipe.machine_id, current);
    }
    return Array.from(grouped, ([machineId, group]) => ({
      machineId,
      machine: machines.find((item) => item.machine_id === machineId),
      floors: group.floors.sort((a, b) => a - b),
      products: Array.from(group.products, ([recipeId, target]) => ({ recipe: recipes.find((item) => item.id === recipeId)!, target }))
        .filter((product) => !!product.recipe)
        .sort((a, b) => a.recipe.name.localeCompare(b.recipe.name, 'th')),
      materials: Array.from(group.materials, ([id, material]) => ({ id, ...material }))
        .sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name, 'th')),
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
            const progress = Math.min(100, Math.round((inStock / target) * 100));
            return <div className="production-targets__item" key={recipe.id}>
              <div className="production-targets__item-name"><ItemLabel id={recipe.id} name={recipe.name} image={recipe.image} size={38} reserveImage /></div>
              <div className="production-targets__counts"><span>มี <b>{formatNumber(inStock)}</b></span><span>/</span><strong>{formatNumber(target)}</strong></div>
              <div className="production-targets__progress" aria-label={`มี ${inStock} จากเป้าหมาย ${target}`}><i className={inStock >= target ? 'is-complete' : ''} style={{ width: `${progress}%` }} /><span>{progress}%</span></div>
            </div>;
          })}
        </div>
        <section className="production-targets__materials">
          <div className="production-targets__materials-heading"><h4>ต้องเตรียมวัตถุดิบ</h4><span>สต็อก / ต้องการ · กอง (÷99)</span></div>
          {materials.length === 0 ? <p className="production-targets__materials-empty">สูตรในเครื่องนี้ไม่มีวัตถุดิบที่ต้องเตรียมเพิ่ม</p> : materials.map((material) => {
            const inStock = stocks[material.id] ?? 0;
            const isSufficient = inStock >= material.quantity;
            return <div className="production-targets__material" key={material.id}>
              <ItemLabel id={material.id} name={material.name} size={26} reserveImage />
              <span
                className="production-targets__material-stock"
                style={{ color: isSufficient ? '#16a34a' : '#dc2626', fontVariantNumeric: 'tabular-nums' }}
              >
                {formatNumber(inStock)}<span style={{ color: '#94a3b8', margin: '0 2px' }}>/</span><strong>{formatNumber(material.quantity)}</strong>
              </span>
              <span style={{ color: '#64748b', fontSize: 12, whiteSpace: 'nowrap' }}>{Math.ceil(material.quantity / 99)} กอง</span>
            </div>;
          })}
        </section>
      </section>)}
    </div>}
  </div>;
}

import { Alert, Button, Empty, Spin, Tag } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { runPlan } from '../../api/client';
import type { Machine, PlanRequest, PlanResponse, Recipe, StockMap } from '../../types';
import { ItemLabel } from '../shared/ItemVisual';

interface ProductionTargetsBoardProps { recipes: Recipe[]; machines: Machine[]; stocks: StockMap; }
interface StoredFloor { floor_number: number; recipe_id: string }

function readStored<T>(key: string, fallback: T): T {
  try { const value = localStorage.getItem(key); return value === null ? fallback : JSON.parse(value) as T; }
  catch { return fallback; }
}

function readPlannerRequest(): PlanRequest | null {
  const floors = readStored<StoredFloor[]>('planner_floors', []).filter((floor) => Number.isInteger(floor.floor_number) && !!floor.recipe_id);
  if (!floors.length) return null;
  const days = readStored<number>('planner_event_days', 30);
  const hours = readStored<number>('planner_event_hours', 0);
  const minutes = readStored<number>('planner_event_minutes', 0);
  if (!Number.isFinite(days) || days < 1) return null;
  return {
    event_days: Math.floor(days), event_hours: Math.max(0, Math.min(23, Math.floor(hours) || 0)),
    event_minutes: Math.max(0, Math.min(59, Math.floor(minutes) || 0)), slots_per_floor: 12,
    floor_assignments: floors.map(({ floor_number, recipe_id }) => ({ floor_number, recipe_id })),
  };
}

function formatNumber(value: number) { return value.toLocaleString('th-TH'); }

export function ProductionTargetsBoard({ recipes, machines, stocks }: ProductionTargetsBoardProps) {
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const request = readPlannerRequest();
    if (!request) { setPlan(null); setLoading(false); return; }
    try { setPlan(await runPlan(request)); }
    catch (err) { setError((err as Error).message || 'คำนวณเป้าหมายการผลิตไม่สำเร็จ'); setPlan(null); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const boards = useMemo(() => {
    const grouped = new Map<string, { floors: number[]; products: Map<string, number> }>();
    for (const result of plan?.floor_results ?? []) {
      const recipe = recipes.find((item) => item.id === result.recipe_id);
      if (!recipe?.machine_id) continue;
      const current = grouped.get(recipe.machine_id) ?? { floors: [], products: new Map<string, number>() };
      current.floors.push(result.floor_number);
      current.products.set(recipe.id, (current.products.get(recipe.id) ?? 0) + result.output_qty);
      grouped.set(recipe.machine_id, current);
    }
    return Array.from(grouped, ([machineId, group]) => ({
      machineId,
      machine: machines.find((item) => item.machine_id === machineId),
      floors: group.floors.sort((a, b) => a - b),
      products: Array.from(group.products, ([recipeId, target]) => ({ recipe: recipes.find((item) => item.id === recipeId)!, target }))
        .filter((product) => !!product.recipe)
        .sort((a, b) => a.recipe.name.localeCompare(b.recipe.name, 'th')),
    })).sort((a, b) => (a.machine?.machine_name ?? a.machineId).localeCompare(b.machine?.machine_name ?? b.machineId, 'th'));
  }, [machines, plan, recipes]);

  const itemCount = boards.reduce((sum, board) => sum + board.products.length, 0);
  const targetTotal = boards.flatMap((board) => board.products).reduce((sum, product) => sum + product.target, 0);

  return <div className="production-targets">
    {error && <Alert type="error" showIcon message="คำนวณเป้าหมายการผลิตไม่สำเร็จ" description={error} action={<Button size="small" onClick={() => void load()}>ลองอีกครั้ง</Button>} />}
    <section className="production-targets__summary">
      <div><span>เครื่องในแผน</span><strong>{boards.length}</strong></div>
      <div><span>สินค้าเป้าหมาย</span><strong>{itemCount}</strong></div>
      <div><span>เป้าหมายผลิตรวม</span><strong>{formatNumber(targetTotal)}</strong></div>
      <p>Target คำนวณจากชั้น สูตร และระยะเวลา Event ในหน้าวางแผนการผลิต <Button type="link" size="small" icon={<ReloadOutlined />} onClick={() => void load()}>คำนวณใหม่</Button></p>
    </section>

    {loading ? <div className="production-targets__loading"><Spin /><span>กำลังคำนวณเป้าหมายจากแผนการผลิต…</span></div> : boards.length === 0 ? (
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="ยังไม่มีสูตรที่เลือกในแผนการผลิต" />
    ) : <div className="production-targets__grid">
      {boards.map(({ machineId, machine, floors, products }) => <section className="production-targets__floor" key={machineId}>
        <header><div><span className="production-targets__floor-number">ชั้น {floors.join(', ')}</span><h3><ItemLabel id={machineId} name={machine?.machine_name ?? 'ไม่พบเครื่องจักร'} image={machine?.image} size={30} reserveImage /></h3></div><Tag color="blue">รวม {floors.length} ชั้น</Tag></header>
        <div className="production-targets__items">
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
      </section>)}
    </div>}
  </div>;
}

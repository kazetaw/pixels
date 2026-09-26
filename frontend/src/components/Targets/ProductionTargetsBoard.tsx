import { Alert, Empty, InputNumber, Spin, Tag } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchFloorTimers } from '../../api/client';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import type { FloorTimer, Machine, Recipe, StockMap } from '../../types';
import { ItemLabel } from '../shared/ItemVisual';

interface ProductionTargetsBoardProps {
  recipes: Recipe[];
  machines: Machine[];
  stocks: StockMap;
}

function formatNumber(value: number) {
  return value.toLocaleString('th-TH');
}

export function ProductionTargetsBoard({ recipes, machines, stocks }: ProductionTargetsBoardProps) {
  const [floors, setFloors] = useState<FloorTimer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [targets, setTargets] = useLocalStorage<Record<string, number>>('production-stock-targets', {});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setFloors(await fetchFloorTimers());
    } catch (err) {
      setError((err as Error).message || 'โหลดข้อมูลชั้นไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const boards = useMemo(() => {
    const groupedFloors = new Map<string, FloorTimer[]>();
    for (const floor of floors) {
      if (!floor.machine_id) continue;
      const group = groupedFloors.get(floor.machine_id) ?? [];
      group.push(floor);
      groupedFloors.set(floor.machine_id, group);
    }
    return Array.from(groupedFloors, ([machineId, assignedFloors]) => {
      const machine = machines.find((item) => item.machine_id === machineId);
      return {
        machineId,
        machine,
        floors: assignedFloors.sort((a, b) => a.floor_number - b.floor_number),
        recipes: recipes
          .filter((recipe) => recipe.machine_id === machineId)
          .sort((a, b) => a.name.localeCompare(b.name, 'th')),
      };
    }).sort((a, b) => (a.machine?.machine_name ?? a.machineId).localeCompare(b.machine?.machine_name ?? b.machineId, 'th'));
  }, [floors, machines, recipes]);

  const itemCount = new Set(boards.flatMap((board) => board.recipes.map((recipe) => recipe.id))).size;
  const targetedCount = Object.values(targets).filter((target) => target > 0).length;

  return <div className="production-targets">
    {error && <Alert type="error" showIcon message="โหลดเป้าหมายการผลิตไม่สำเร็จ" description={error} />}

    <section className="production-targets__summary">
      <div><span>เครื่องที่กำลังใช้งาน</span><strong>{boards.length}</strong></div>
      <div><span>สินค้าในเครื่องที่เลือก</span><strong>{itemCount}</strong></div>
      <div><span>ตั้งเป้าหมายแล้ว</span><strong>{targetedCount}</strong></div>
      <p>แต่ละการ์ดรวมชั้นที่ใช้เครื่องเดียวกัน เพื่อกำหนดเป้าหมายสินค้าได้ง่ายขึ้น</p>
    </section>

    {loading ? <div className="production-targets__loading"><Spin /><span>กำลังโหลดชั้นและชุดสินค้า…</span></div> : boards.length === 0 ? (
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="ยังไม่มีชั้นที่เลือกเครื่องจักร" />
    ) : <div className="production-targets__grid">
      {boards.map(({ machineId, machine, floors: assignedFloors, recipes: machineRecipes }) => <section className="production-targets__floor" key={machineId}>
        <header>
          <div>
            <span className="production-targets__floor-number">ชั้น {assignedFloors.map((floor) => floor.floor_number).join(', ')}</span>
            <h3><ItemLabel id={machineId} name={machine?.machine_name ?? 'ไม่พบเครื่องจักร'} image={machine?.image} size={30} reserveImage /></h3>
          </div>
          <Tag color="blue">รวม {assignedFloors.length} ชั้น</Tag>
        </header>

        {machineRecipes.length === 0 ? <p className="production-targets__empty">ยังไม่มี Recipe ที่ผูกกับเครื่องนี้</p> : (
          <div className="production-targets__items">
            {machineRecipes.map((recipe) => {
              const inStock = stocks[recipe.id] ?? 0;
              const target = targets[recipe.id] ?? 0;
              const progress = target > 0 ? Math.min(100, Math.round((inStock / target) * 100)) : 0;
              const complete = target > 0 && inStock >= target;
              return <div className="production-targets__item" key={recipe.id}>
                <div className="production-targets__item-name"><ItemLabel id={recipe.id} name={recipe.name} image={recipe.image} size={38} reserveImage /></div>
                <div className="production-targets__counts">
                  <span>มี <b>{formatNumber(inStock)}</b></span><span>/</span>
                  <label>Target <InputNumber min={0} precision={0} value={target || null} placeholder="0" controls={false} onChange={(value) => setTargets((current) => ({ ...current, [recipe.id]: Math.max(0, Math.floor(value ?? 0)) }))} /></label>
                </div>
                {target > 0 && <div className="production-targets__progress" aria-label={`มี ${inStock} จากเป้าหมาย ${target}`}>
                  <i className={complete ? 'is-complete' : ''} style={{ width: `${progress}%` }} /><span>{progress}%</span>
                </div>}
              </div>;
            })}
          </div>
        )}
      </section>)}
    </div>}
  </div>;
}

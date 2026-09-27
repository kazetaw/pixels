import { Alert, Button, Empty, Spin } from 'antd';
import { CheckCircleFilled, ReloadOutlined, RightOutlined, WarningFilled } from '@ant-design/icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BomTreeNode, PlanResponse, PlannerFloorRow, SharedPlannerPlan } from '../../types';
import { fetchSharedPlannerPlan, runPlan } from '../../api/client';
import { ItemLabel } from '../shared/ItemVisual';

type FlowData = { plan: SharedPlannerPlan; result: PlanResponse };
const number = (value: number) => value.toLocaleString('th-TH');

function FlowMaterial({ material }: { material: BomTreeNode }) {
  const source = material.produced_by_floor ? `กำลังผลิตที่ชั้น ${material.produced_by_floor}` : 'ใช้จากสต็อก / จัดหาเพิ่ม';
  return <li className={`production-flow-material${material.produced_by_floor ? ' is-transferred' : ''}`}>
    <ItemLabel id={material.item_id} name={material.item_name} size={28} reserveImage />
    <span className="production-flow-material__quantity">×{number(material.quantity_needed)}</span>
    <small>{source}</small>
  </li>;
}

function FlowCard({ floor, occupation }: { floor: PlanResponse['floor_results'][number]; occupation: string }) {
  const materials = floor.bom_tree.children;
  const transferCount = materials.filter((material) => material.produced_by_floor).length;
  const deeperMaterials = materials.flatMap((material) => material.children);
  return <article className="production-flow-card">
    <header className="production-flow-card__head"><span className="production-flow-floor">ชั้น {floor.floor_number}</span><span className="production-flow-occupation">{occupation || 'ยังไม่ระบุอาชีพ'}</span></header>
    <div className="production-flow-product"><ItemLabel id={floor.recipe_id} name={floor.recipe_name} size={48} reserveImage /><div><strong>ผลิต {number(floor.output_qty)} ชิ้น</strong><span>{floor.time_per_unit} / ชิ้น · {number(floor.cycles)} รอบ</span></div></div>
    <div className="production-flow-requirements">
      <div className="production-flow-requirements__heading"><strong>ต้องรับเข้ามา</strong>{transferCount > 0 && <span className="production-flow-transfer-badge">จากชั้นอื่น {transferCount}</span>}</div>
      {materials.length ? <ul>{materials.map((material) => <FlowMaterial key={`${material.item_id}-${material.item_name}`} material={material} />)}</ul> : <p className="production-flow-no-material">ไม่ใช้วัตถุดิบ · ผลิตได้ทันที</p>}
    </div>
    {deeperMaterials.length > 0 && <details className="production-flow-details"><summary>ดูของที่ต้องใช้ลึกลงไป <RightOutlined /></summary><ul>{deeperMaterials.map((material) => <FlowMaterial key={`deep-${material.item_id}-${material.item_name}`} material={material} />)}</ul></details>}
  </article>;
}

export function ProductionFlowBoard() {
  const [data, setData] = useState<FlowData | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setState('loading'); setError('');
    try {
      const plan = await fetchSharedPlannerPlan();
      const assignments = plan?.floors.filter((floor) => floor.recipe_id) ?? [];
      if (!plan || !assignments.length) { setData(null); setState('empty'); return; }
      const result = await runPlan({ event_days: plan.event_days, event_hours: plan.event_hours, event_minutes: plan.event_minutes, slots_per_floor: 12,
        floor_assignments: assignments.map((floor) => ({ floor_number: floor.floor_number, recipe_id: floor.recipe_id })) });
      setData({ plan, result }); setState('ready');
    } catch (reason) { setData(null); setError((reason as Error).message || 'โหลดข้อมูลแผนไม่สำเร็จ'); setState('error'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const occupationByFloor = useMemo(() => new Map<number, string>(data?.plan.floors.map((floor: PlannerFloorRow) => [floor.floor_number, floor.occupation]) ?? []), [data]);
  const floors = useMemo(() => [...(data?.result.floor_results ?? [])].sort((a, b) => a.floor_number - b.floor_number), [data]);
  const transferred = data?.result.intermediate_supply.filter((item) => item.produced > 0).length ?? 0;
  const missing = (data?.result.raw_materials.filter((item) => item.net_required > 0).length ?? 0) + (data?.result.intermediate_supply.filter((item) => item.shortfall > 0).length ?? 0);

  return <section className="production-flow-board" aria-label="แผนส่งต่อระหว่างชั้น">
    <div className="production-flow-toolbar"><div><span className="production-flow-kicker">อ่านข้อมูลจากแผนส่วนกลาง</span><h3>แผนส่งต่อระหว่างชั้น</h3><p>ดูวัตถุดิบที่แต่ละชั้นต้องรับ และไล่สูตรต่อได้โดยไม่แก้แผนเดิม</p></div><Button icon={<ReloadOutlined />} onClick={() => void load()} loading={state === 'loading'}>รีเฟรชข้อมูล</Button></div>
    {state === 'loading' && <div className="production-flow-state"><Spin size="large" /><span>กำลังอ่านแผนและคำนวณของที่ต้องส่งต่อ…</span></div>}
    {state === 'error' && <Alert type="error" showIcon message="โหลดแผนไม่ได้" description={error} action={<Button size="small" onClick={() => void load()}>ลองอีกครั้ง</Button>} />}
    {state === 'empty' && <Empty description="ยังไม่มีรายการในแผนส่วนกลาง"><p>ไปกำหนดสูตรในแต่ละชั้นก่อน แล้วหน้านี้จะไล่ของส่งต่อให้เอง</p></Empty>}
    {state === 'ready' && data && <>
      <dl className="production-flow-metrics"><div><dt>ชั้นที่วางแผน</dt><dd>{floors.length}</dd><span>ชั้น</span></div><div><dt>รายการส่งต่อ</dt><dd>{transferred}</dd><span>ชนิดสินค้าแปรรูป</span></div><div><dt>รายการที่ยังขาด</dt><dd className={missing ? 'is-warning' : ''}>{missing}</dd><span>{missing ? 'ต้องเตรียมหรือเพิ่มแผน' : 'พร้อมตามแผน'}</span></div></dl>
      <div className={`production-flow-notice${missing ? '' : ' is-ok'}`}>{missing ? <WarningFilled /> : <CheckCircleFilled />}{missing ? `ยังมี ${missing} รายการที่ไม่พอ ดูป้าย “ใช้จากสต็อก / จัดหาเพิ่ม” ในแต่ละชั้น` : 'วัตถุดิบและสินค้าที่ส่งต่อมีเพียงพอตามแผนนี้'}</div>
      <div className="production-flow-list">{floors.map((floor, index) => <div className="production-flow-step" key={floor.floor_number}>{index > 0 && <div className="production-flow-arrow" aria-hidden="true">↓</div>}<FlowCard floor={floor} occupation={occupationByFloor.get(floor.floor_number) ?? ''} /></div>)}</div>
    </>}
  </section>;
}

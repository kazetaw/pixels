import { ItemLabel, itemSelectVisuals } from '../shared/ItemVisual';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Popconfirm, Select } from 'antd';
import { ArrowLeftOutlined, PlayCircleOutlined } from '@ant-design/icons';
import type { Recipe, Machine, PlanRequest, PlanResponse, PlannerFloorRow, SharedPlannerPlan } from '../../types';
import { fetchSharedPlannerPlan, runPlan, saveSharedPlannerPlan } from '../../api/client';
import { PlanSummary } from './PlanSummary';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { groupFloorRows, recipesForOccupation } from './planPresentation';

interface ProductionPlannerProps {
  recipes: Recipe[];
  stocks: Record<string, number>;
  machines?: Machine[];
  mode?: 'local' | 'shared';
}
const TOTAL_FLOORS = 27;
const SLOTS_PER_FLOOR = 12;
const createFloors = (): PlannerFloorRow[] => Array.from({ length: TOTAL_FLOORS }, (_, index) => ({ floor_number: index + 1, occupation: '', recipe_id: '' }));

export function ProductionPlanner({ recipes, stocks, machines = [], mode = 'local' }: ProductionPlannerProps) {
  const [localEventDays, setLocalEventDays] = useLocalStorage<number>('planner_event_days', 30);
  const [localEventHours, setLocalEventHours] = useLocalStorage<number>('planner_event_hours', 0);
  const [localEventMinutes, setLocalEventMinutes] = useLocalStorage<number>('planner_event_minutes', 0);
  const [localFloors, setLocalFloors] = useLocalStorage<PlannerFloorRow[]>('planner_floors', createFloors());
  const [sharedEventDays, setSharedEventDays] = useState(30);
  const [sharedEventHours, setSharedEventHours] = useState(0);
  const [sharedEventMinutes, setSharedEventMinutes] = useState(0);
  const [sharedFloors, setSharedFloors] = useState<PlannerFloorRow[]>(createFloors);
  const [result, setResult] = useState<{ data: PlanResponse; key: string } | null>(null);
  const [view, setView] = useState<'configure' | 'summary'>('configure');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sharedState, setSharedState] = useState<'loading' | 'saved' | 'saving' | 'error'>(mode === 'shared' ? 'loading' : 'saved');
  const [sharedError, setSharedError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string>();
  const hydrated = useRef(false);
  const isShared = mode === 'shared';
  const eventDays = isShared ? sharedEventDays : localEventDays;
  const setEventDays = isShared ? setSharedEventDays : setLocalEventDays;
  const eventHours = isShared ? sharedEventHours : localEventHours;
  const setEventHours = isShared ? setSharedEventHours : setLocalEventHours;
  const eventMinutes = isShared ? sharedEventMinutes : localEventMinutes;
  const setEventMinutes = isShared ? setSharedEventMinutes : setLocalEventMinutes;
  const floors = isShared ? sharedFloors : localFloors;
  const setFloors = isShared ? setSharedFloors : setLocalFloors;
  const totalHours = eventDays * 24 + eventHours + eventMinutes / 60;
  const assigned = floors.filter((floor) => floor.recipe_id);
  const groups = groupFloorRows(floors);
  const occupations = useMemo(() => ['ทุกอาชีพ', ...Array.from(new Set(machines.map((machine) => machine.occupation)
    .filter((occupation): occupation is NonNullable<Machine['occupation']> => !!occupation && occupation !== 'ทุกอาชีพ')))
    .sort((a, b) => a.localeCompare(b, 'th'))], [machines]);
  const optionsByOccupation = useMemo(() => new Map(['', ...occupations].map((occupation) => [occupation,
    recipesForOccupation(recipes, machines, occupation).map((recipe) => ({ value: recipe.id, label: recipe.name, time: recipe.time_per_unit })),
  ])), [recipes, machines, occupations]);
  const dataKey = useMemo(() => JSON.stringify([floors, eventDays, eventHours, eventMinutes, recipes, stocks]),
    [floors, eventDays, eventHours, eventMinutes, recipes, stocks]);
  const stale = !!result && result.key !== dataKey;

  useEffect(() => {
    if (!isShared) return;
    let active = true;
    void fetchSharedPlannerPlan().then((plan) => {
      if (!active) return;
      if (plan) {
        setSharedEventDays(plan.event_days); setSharedEventHours(plan.event_hours); setSharedEventMinutes(plan.event_minutes);
        setSharedFloors([...plan.floors].sort((a, b) => a.floor_number - b.floor_number)); setSavedAt(plan.updated_at);
      }
      hydrated.current = true; setSharedState('saved');
    }).catch((err) => {
      if (!active) return;
      hydrated.current = true; setSharedError((err as Error).message || 'โหลดแผนส่วนกลางไม่สำเร็จ'); setSharedState('error');
    });
    return () => { active = false; };
  }, [isShared]);

  useEffect(() => {
    if (!isShared || !hydrated.current) return;
    const plan: SharedPlannerPlan = { event_days: sharedEventDays, event_hours: sharedEventHours, event_minutes: sharedEventMinutes, floors: sharedFloors };
    const timer = window.setTimeout(() => {
      setSharedState('saving'); setSharedError(null);
      void saveSharedPlannerPlan(plan).then((saved) => { setSavedAt(saved.updated_at); setSharedState('saved'); })
        .catch((err) => { setSharedError((err as Error).message || 'บันทึกแผนส่วนกลางไม่สำเร็จ'); setSharedState('error'); });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [isShared, sharedEventDays, sharedEventHours, sharedEventMinutes, sharedFloors]);

  const changeFloor = (number: number, patch: Partial<PlannerFloorRow>) => {
    setFloors((current) => current.map((floor) => floor.floor_number === number ? { ...floor, ...patch } : floor));
    setError(null);
  };
  const calculate = async () => {
    if (!assigned.length) { setError('เลือกสูตรอย่างน้อย 1 ชั้นก่อนคำนวณ'); return; }
    if (!Number.isFinite(totalHours) || eventDays < 1 || totalHours <= 0) {
      setError('กำหนดระยะเวลา Event อย่างน้อย 1 วัน'); return;
    }
    const valid = new Set(recipesForOccupation(recipes, machines, '').map((recipe) => recipe.id));
    const invalid = assigned.filter((floor) => !valid.has(floor.recipe_id));
    if (invalid.length) { setError(`กรุณาเลือกสูตรที่มีเวลาผลิตใหม่สำหรับชั้น ${invalid.map((floor) => floor.floor_number).join(', ')}`); return; }
    setLoading(true); setError(null);
    try {
      const request: PlanRequest = { event_days: eventDays, event_hours: eventHours, event_minutes: eventMinutes,
        slots_per_floor: SLOTS_PER_FLOOR, floor_assignments: assigned.map(({ floor_number, recipe_id }) => ({ floor_number, recipe_id })) };
      const data = await runPlan(request);
      setResult({ data, key: dataKey });
      setView('summary');
    } catch (err) { setError((err as Error).message || 'คำนวณไม่สำเร็จ กรุณาลองอีกครั้ง'); }
    finally { setLoading(false); }
  };

  return <div className="production-planner">
    {isShared && <div className={`planner-shared-status planner-shared-status--${sharedState}`} role="status">
      {sharedState === 'loading' && 'กำลังโหลดแผนส่วนกลาง…'}
      {sharedState === 'saving' && 'กำลังบันทึกแผนให้ทุกคน…'}
      {sharedState === 'saved' && `แผนนี้ใช้ร่วมกัน · บันทึกล่าสุด ${savedAt ? new Date(savedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : 'เมื่อกี้'} น.`}
      {sharedState === 'error' && `แผนยังไม่ถูกบันทึก · ${sharedError}`}
    </div>}
    <div className="planner-navigation">
      <nav className="planner-view-switch" aria-label="หน้าวางแผน">
        <button type="button" aria-pressed={view === 'configure'} onClick={() => setView('configure')}>กำหนดชั้น <span>{assigned.length}/{TOTAL_FLOORS}</span></button>
        <button type="button" aria-pressed={view === 'summary'} disabled={!result} onClick={() => setView('summary')}>ผลการคำนวณ {stale && <span>ต้องคำนวณใหม่</span>}</button>
      </nav>
      {view === 'summary' && <Button icon={<ArrowLeftOutlined />} onClick={() => setView('configure')}>แก้ไขแผน</Button>}
    </div>
    {error && <Alert type="error" showIcon message={error} />}
    {stale && <Alert type="warning" showIcon message="แผนหรือข้อมูลเปลี่ยนแล้ว ผลด้านล่างยังเป็นรอบก่อนหน้า" action={<Button loading={loading} onClick={() => void calculate()}>คำนวณใหม่</Button>} />}

    {view === 'configure' && <>
      {!assigned.length && <div className="planner-starting-hint" role="status">
        <strong>เริ่มวางแผน</strong><span>เลือกอาชีพและสูตรในชั้นที่ต้องการผลิตอย่างน้อย 1 ชั้น แล้วจึงคำนวณ</span>
      </div>}
      <section className="planner-event-bar" aria-label="ระยะเวลา Event">
        <strong>ระยะเวลา Event</strong>
        {[{ label: 'วัน', value: eventDays, min: 1, max: 365, set: setEventDays },
          { label: 'ชั่วโมง', value: eventHours, min: 0, max: 23, set: setEventHours },
          { label: 'นาที', value: eventMinutes, min: 0, max: 59, set: setEventMinutes }].map(({ label, value, min, max, set }) =>
          <label key={label}><input type="number" aria-label={`ระยะเวลา ${label}`} min={min} max={max} step={1} value={value} disabled={loading}
            onChange={(event) => set(Math.max(min, Math.min(max, Math.floor(Number(event.target.value) || 0))))} /><span>{label}</span></label>)}
        <span className="planner-duration-total">รวม {totalHours.toLocaleString('th-TH', { maximumFractionDigits: 2 })} ชั่วโมง</span>
      </section>

      <div className="planner-assignment-grid">
        {groups.map((group) => <section className="planner-floor-group" key={group[0].floor_number} aria-label={`กำหนดชั้น ${group[0].floor_number} ถึง ${group[group.length - 1].floor_number}`}>
          <div className="planner-group-heading"><h4>ชั้น {group[0].floor_number}–{group[group.length - 1].floor_number}</h4><span>{group.filter((floor) => floor.recipe_id).length}/{group.length} ชั้น</span></div>
          <div className="planner-entry-labels" aria-hidden="true"><span>ชั้น</span><span>อาชีพ</span><span>สูตรการผลิต</span></div>
          {group.map((floor) => <div className={`planner-entry-row${floor.recipe_id ? ' is-assigned' : ''}`} key={floor.floor_number}>
            <span className="planner-floor-number">{String(floor.floor_number).padStart(2, '0')}</span>
            <Select {...itemSelectVisuals} aria-label={`อาชีพชั้น ${floor.floor_number}`} value={floor.occupation || 'ทุกอาชีพ'} disabled={loading}
              onChange={(occupation) => changeFloor(floor.floor_number, { occupation, recipe_id: '' })}
              options={occupations.map((occupation) => ({ label: occupation, value: occupation }))} popupMatchSelectWidth={false} />
            <Select {...itemSelectVisuals} aria-label={`สูตรชั้น ${floor.floor_number}`} value={floor.recipe_id || undefined} disabled={loading}
              placeholder="พิมพ์ค้นหาสูตร" showSearch optionFilterProp="label"
              labelRender={({ value }) => <ItemLabel id={String(value)} name={recipes.find((recipe) => recipe.id === value)?.name ?? 'เลือกสูตรใหม่'} size={22} />}
              onChange={(recipeId) => changeFloor(floor.floor_number, { recipe_id: recipeId ?? '' })}
              options={[{ value: '', label: 'ไม่กำหนดสูตร', time: null }, ...(optionsByOccupation.get(floor.occupation) ?? optionsByOccupation.get('') ?? [])]}
              popupMatchSelectWidth={false} classNames={{ popup: { root: 'planner-recipe-popup' } }}
              optionRender={(option) => <div className="planner-recipe-option"><ItemLabel id={String(option.value)} name={option.label} size={28} /><small>{option.data.time}</small></div>} />
          </div>)}
        </section>)}
      </div>
      <div className="planner-entry-footer"><p><kbd>Tab</kbd> ช่องถัดไป <span>·</span> <kbd>Shift + Tab</kbd> ย้อนกลับ <span>·</span> {SLOTS_PER_FLOOR} เครื่อง/ชั้น</p>
        <div className="planner-entry-actions"><Popconfirm title="ล้างสูตรที่เลือกทั้ง 27 ชั้น?" okText="ล้างทั้งหมด" cancelText="ยกเลิก" onConfirm={() => {
        setFloors((current) => current.map((floor) => ({ ...floor, occupation: '', recipe_id: '' }))); setError(null);
      }}><Button type="text" disabled={loading || !assigned.length}>ล้างทั้งหมด</Button></Popconfirm><Button type="primary" icon={<PlayCircleOutlined />} loading={loading} disabled={!assigned.length} title={!assigned.length ? 'เลือกสูตรอย่างน้อย 1 ชั้นก่อนคำนวณ' : undefined} onClick={() => void calculate()}>คำนวณแผนการผลิต</Button></div>
      </div>
    </>}
    {view === 'summary' && result && <PlanSummary key={result.key} result={result.data} />}
  </div>;
}

// frontend/src/components/Planner/ProductionPlanner.tsx
import { useState, useCallback, useMemo } from 'react';
import { Spin, Empty, Select } from 'antd';
import { LoadingOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { Recipe, Machine, PlanRequest, PlanResponse, FloorAssignment } from '../../types';
import { runPlan } from '../../api/client';
import { PlanSummary } from './PlanSummary';
import { useLocalStorage } from '../../hooks/useLocalStorage';

interface ProductionPlannerProps {
  recipes: Recipe[];
  stocks: Record<string, number>;
  machines?: Machine[];
}

const TOTAL_FLOORS = 27;
const SLOTS_PER_FLOOR = 12;

interface FloorRow {
  floor_number: number;
  occupation: string;  // '' = ไม่กรอง, or occupation value
  recipe_id: string;   // '' = ไม่กำหนด
}


function parseTime(t: string | null): number {
  if (!t) return 0;
  const [h, m, s] = t.split(':').map(Number);
  return h + m / 60 + s / 3600;
}

export function ProductionPlanner({ recipes, machines = [] }: ProductionPlannerProps) {
  // ── Event duration ──────────────────────────────────────────────────────────
  const [eventDays, setEventDays]       = useLocalStorage<number>('planner_event_days', 30);
  const [eventHours, setEventHoursVal]  = useLocalStorage<number>('planner_event_hours', 0);
  const [eventMinutes, setEventMinutes] = useLocalStorage<number>('planner_event_minutes', 0);

  // ── Floor assignments ───────────────────────────────────────────────────────
  const [floors, setFloors] = useLocalStorage<FloorRow[]>(
    'planner_floors',
    Array.from({ length: TOTAL_FLOORS }, (_, i) => ({
      floor_number: i + 1,
      occupation: '',
      recipe_id: '',
    }))
  );

  // ── Result / loading / error ────────────────────────────────────────────────
  const [result, setResult]   = useState<PlanResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // ── Derived data ────────────────────────────────────────────────────────────
  // map machine_id → occupation
  const machineOccupationMap = useMemo(
    () => new Map(machines.map((m) => [m.machine_id, m.occupation ?? ''])),
    [machines]
  );

  // available occupations from machines that have recipes
  const recipeMachineIds = useMemo(() => new Set(recipes.map((r) => r.machine_id)), [recipes]);
  const availableOccupations = useMemo(() => {
    const occs = new Set<string>();
    machines.forEach((m) => {
      if (recipeMachineIds.has(m.machine_id) && m.occupation) occs.add(m.occupation);
    });
    return Array.from(occs).sort((a, b) => a.localeCompare(b, 'th'));
  }, [machines, recipeMachineIds]);

  const hasOccupations = availableOccupations.length > 0;

  // recipes with time only
  const recipesWithTime = useMemo(
    () => recipes.filter((r) => r.time_per_unit !== null),
    [recipes]
  );

  // get filtered recipes for a floor given its occupation
  const getFilteredRecipes = useCallback(
    (occupation: string): Recipe[] => {
      if (!hasOccupations || occupation === '') return recipesWithTime;
      return recipesWithTime.filter((r) => {
        const occ = machineOccupationMap.get(r.machine_id ?? '') ?? '';
        return occ === occupation;
      }).sort((a, b) => a.name.localeCompare(b.name, 'th'));
    },
    [hasOccupations, recipesWithTime, machineOccupationMap]
  );

  // ── Handlers ────────────────────────────────────────────────────────────────
  const setFloorOccupation = useCallback((floorNum: number, occ: string) => {
    setFloors((prev) =>
      prev.map((f) =>
        f.floor_number === floorNum
          ? { ...f, occupation: occ, recipe_id: '' } // reset recipe when occupation changes
          : f
      )
    );
  }, []);

  const setFloorRecipe = useCallback((floorNum: number, recipeId: string) => {
    setFloors((prev) =>
      prev.map((f) => f.floor_number === floorNum ? { ...f, recipe_id: recipeId } : f)
    );
  }, []);

  const clearAll = useCallback(() => {
    setFloors((prev) => prev.map((f) => ({ ...f, occupation: '', recipe_id: '' })));
    setResult(null);
    setError(null);
  }, []);

  const handleCalculate = useCallback(async () => {
    const assigned = floors.filter((f) => f.recipe_id !== '');
    if (assigned.length === 0) {
      setError('กรุณากำหนด Recipe ให้อย่างน้อย 1 ชั้น');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const body: PlanRequest = {
        event_days: eventDays,
        event_hours: eventHours,
        event_minutes: eventMinutes,
        slots_per_floor: SLOTS_PER_FLOOR,
        floor_assignments: assigned.map((f): FloorAssignment => ({
          floor_number: f.floor_number,
          recipe_id: f.recipe_id,
        })),
      };
      const res = await runPlan(body);
      setResult(res);
    } catch (err: unknown) {
      setError((err as Error).message ?? 'คำนวณไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [floors, eventDays, eventHours, eventMinutes]);

  const totalEventHours = eventDays * 24 + eventHours + eventMinutes / 60;
  const assignedCount = floors.filter((f) => f.recipe_id !== '').length;

  return (
    <div className="planner-layout">
      {/* ── Left: config panel ── */}
      <div className="planner-config flex flex-col gap-4">

        {/* Event duration */}
        <section className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">ระยะเวลา Event</h3>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'วัน', value: eventDays, max: 365, setter: setEventDays },
              { label: 'ชั่วโมง', value: eventHours, max: 23, setter: setEventHoursVal },
              { label: 'นาที', value: eventMinutes, max: 59, setter: setEventMinutes },
            ].map(({ label, value, max, setter }) => (
              <div key={label}>
                <label className="text-xs text-gray-500 mb-1 block">{label}</label>
                <input
                  type="number" min={0} max={max} value={value}
                  onChange={(e) => setter(Math.max(0, Math.min(max, Number(e.target.value))))}
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-center focus:border-blue-500 focus:outline-none"
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-blue-600 font-medium">
            รวม {totalEventHours % 1 === 0 ? totalEventHours : totalEventHours.toFixed(2)} ชั่วโมง
          </p>
        </section>

        {/* Floor assignment */}
        <section className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">กำหนดชั้น</h3>
            <button onClick={clearAll} className="text-xs text-gray-400 hover:text-red-500">
              ล้างทั้งหมด
            </button>
          </div>
          <p className="text-xs text-gray-400">
            {assignedCount}/{TOTAL_FLOORS} ชั้น · {SLOTS_PER_FLOOR} เครื่อง/ชั้น
          </p>

          {/* Column headers */}
          <div className="planner-floor-heading text-xs text-gray-400 font-medium">
            <span className="text-center">ชั้น</span>
            <span>{hasOccupations ? 'อาชีพ / สูตรการผลิต' : 'สูตรการผลิต'}</span>
            <span className="text-right">ชิ้น</span>
          </div>

          {/* Floor rows */}
          <div className="planner-floor-list">
            {floors.map((f) => {
              const filteredRecipes = getFilteredRecipes(f.occupation);
              const selectedRecipe = recipes.find((r) => r.id === f.recipe_id);
              const previewCount = selectedRecipe
                ? Math.floor(totalEventHours / parseTime(selectedRecipe.time_per_unit)) * SLOTS_PER_FLOOR
                : 0;

              return (
                <div
                  key={f.floor_number}
                  className={`planner-floor-row${hasOccupations ? ' planner-floor-row--with-occupation' : ''}`}
                >
                  {/* ชั้น badge */}
                  <span className="text-xs font-semibold text-gray-500 text-center w-8 flex-shrink-0">
                    {f.floor_number}
                  </span>

                  {/* Occupation dropdown */}
                  {hasOccupations && (
                    <Select
                      value={f.occupation || undefined}
                      onChange={(v) => setFloorOccupation(f.floor_number, v ?? '')}
                      aria-label={`อาชีพชั้น ${f.floor_number}`}
                      placeholder="อาชีพ"
                      allowClear
                      className="planner-floor-occupation"
                      options={availableOccupations.map((occ) => ({ label: occ, value: occ }))}
                    />
                  )}

                  {/* Recipe dropdown */}
                  <Select
                    value={f.recipe_id || undefined}
                    onChange={(v) => setFloorRecipe(f.floor_number, v ?? '')}
                    aria-label={`สูตรชั้น ${f.floor_number}`}
                    placeholder="เลือกสูตรการผลิต"
                    allowClear
                    showSearch
                    className="planner-floor-recipe"
                    options={filteredRecipes.map((r) => ({
                      label: `${r.name} (${r.time_per_unit})`,
                      value: r.id,
                    }))}
                    filterOption={(input, opt) =>
                      (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                  />

                  {/* Preview count */}
                  <span className="planner-floor-count text-xs text-gray-400 text-right tabular-nums">
                    {f.recipe_id ? `×${previewCount.toLocaleString()}` : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Calculate button */}
        <div className="space-y-2">
          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
          )}
          <button
            onClick={handleCalculate}
            disabled={loading || assignedCount === 0}
            className="w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading
              ? <><Spin indicator={<LoadingOutlined style={{ fontSize: 14, color: '#fff' }} spin />} /> กำลังคำนวณ…</>
              : <><PlayCircleOutlined /> คำนวณแผนการผลิต</>
            }
          </button>
        </div>
      </div>

      {/* ── Right: results ── */}
      <div className="min-w-0 overflow-y-auto">
        {!result && !loading && !error && (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={<span style={{ fontSize: 13, color: '#94a3b8' }}>กำหนดชั้นและสูตรการผลิต แล้วกดคำนวณ</span>}
            style={{ padding: '60px 0' }}
          />
        )}
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Spin indicator={<LoadingOutlined style={{ fontSize: 28, color: '#2563eb' }} spin />} />
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 12 }}>กำลังคำนวณ…</div>
          </div>
        )}
        {result && !loading && <PlanSummary result={result} />}
      </div>
    </div>
  );
}

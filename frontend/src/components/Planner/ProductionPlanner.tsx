// frontend/src/components/Planner/ProductionPlanner.tsx
import { useState, useCallback } from 'react';
import { Recipe, PlanRequest, PlanResponse, FloorAssignment } from '../../types';
import { runPlan } from '../../api/client';
import { PlanSummary } from './PlanSummary';
import { useLocalStorage } from '../../hooks/useLocalStorage';

interface ProductionPlannerProps {
  recipes: Recipe[];
  stocks: Record<string, number>;
}

const TOTAL_FLOORS = 27;
const SLOTS_PER_FLOOR = 12;

interface FloorRow {
  floor_number: number;
  recipe_id: string; // '' = ไม่ได้กำหนด
}

function Spinner() {
  return (
    <svg className="inline h-4 w-4 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export function ProductionPlanner({ recipes }: ProductionPlannerProps) {
  // ── Event duration ──────────────────────────────────────────────────────────
  const [eventDays, setEventDays] = useLocalStorage<number>('planner_event_days', 30);
  const [eventHours, setEventHoursVal] = useLocalStorage<number>('planner_event_hours', 0);
  const [eventMinutes, setEventMinutes] = useLocalStorage<number>('planner_event_minutes', 0);

  // ── Floor assignments (27 rows) ─────────────────────────────────────────────
  const [floors, setFloors] = useLocalStorage<FloorRow[]>(
    'planner_floors',
    Array.from({ length: TOTAL_FLOORS }, (_, i) => ({ floor_number: i + 1, recipe_id: '' }))
  );

  // ── Result / loading / error ────────────────────────────────────────────────
  const [result, setResult] = useState<PlanResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const setFloorRecipe = useCallback((floorNum: number, recipeId: string) => {
    setFloors((prev) =>
      prev.map((f) => (f.floor_number === floorNum ? { ...f, recipe_id: recipeId } : f))
    );
  }, []);

  const clearAll = useCallback(() => {
    setFloors((prev) => prev.map((f) => ({ ...f, recipe_id: '' })));
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

  // ── Group recipes by machine name for display ───────────────────────────────
  const recipesWithTime = recipes.filter((r) => r.time_per_unit !== null);

  // helper: parse "HH:MM:SS" to decimal hours (frontend-side for preview only)
  const parseTime = (t: string | null): number => {
    if (!t) return 0;
    const [h, m, s] = t.split(':').map(Number);
    return h + m / 60 + s / 3600;
  };
  const totalEventHours = eventDays * 24 + eventHours + eventMinutes / 60;
  const assignedCount = floors.filter((f) => f.recipe_id !== '').length;

  return (
    <div className="flex gap-6 h-full">
      {/* ── Left: config panel ── */}
      <div className="w-80 flex-shrink-0 flex flex-col gap-5 overflow-y-auto pr-1">

        {/* Event duration */}
        <section className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 space-y-3">
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">⏱ ระยะเวลา Event</h3>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">วัน</label>
              <input
                type="number" min={0} value={eventDays}
                onChange={(e) => setEventDays(Math.max(0, Number(e.target.value)))}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-center focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">ชั่วโมง</label>
              <input
                type="number" min={0} max={23} value={eventHours}
                onChange={(e) => setEventHoursVal(Math.max(0, Number(e.target.value)))}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-center focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">นาที</label>
              <input
                type="number" min={0} max={59} value={eventMinutes}
                onChange={(e) => setEventMinutes(Math.max(0, Number(e.target.value)))}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-center focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
          <p className="text-xs text-indigo-600 font-medium">
            รวม {totalEventHours.toFixed(2)} ชั่วโมง
          </p>
        </section>

        {/* Floor assignment */}
        <section className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 space-y-2 flex-1 overflow-y-auto">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">🏭 กำหนดชั้น</h3>
            <button onClick={clearAll} className="text-xs text-gray-400 hover:text-red-500">ล้างทั้งหมด</button>
          </div>
          <p className="text-xs text-gray-400 mb-2">
            {assignedCount}/{TOTAL_FLOORS} ชั้น · {SLOTS_PER_FLOOR} เครื่อง/ชั้น
          </p>

          <div className="space-y-1 max-h-[50vh] overflow-y-auto pr-1">
            {floors.map((f) => {
              const selectedRecipe = recipes.find((r) => r.id === f.recipe_id);
              return (
                <div key={f.floor_number} className="flex items-center gap-2">
                  <span className="w-8 text-xs font-semibold text-gray-500 text-center flex-shrink-0">
                    {f.floor_number}
                  </span>
                  <select
                    value={f.recipe_id}
                    onChange={(e) => setFloorRecipe(f.floor_number, e.target.value)}
                    className={`flex-1 rounded border text-xs px-2 py-1.5 focus:outline-none focus:border-blue-500 ${
                      f.recipe_id ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-gray-200 bg-white text-gray-400'
                    }`}
                  >
                    <option value="">— ไม่กำหนด —</option>
                    {recipesWithTime.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.time_per_unit})
                      </option>
                    ))}
                  </select>
                  {selectedRecipe && (
                    <span className="text-xs text-gray-400 w-10 text-right flex-shrink-0">
                      ×{Math.floor(totalEventHours / (parseTime(selectedRecipe.time_per_unit ?? null))) * SLOTS_PER_FLOOR}
                    </span>
                  )}
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
            className="w-full rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Spinner /> กำลังคำนวณ…
              </span>
            ) : (
              '📊 คำนวณแผนการผลิต'
            )}
          </button>
        </div>
      </div>

      {/* ── Right: results ── */}
      <div className="flex-1 overflow-y-auto">
        {!result && !loading && !error && (
          <div className="flex flex-col items-center justify-center h-64 text-center rounded-lg border-2 border-dashed border-gray-200 bg-white">
            <span className="text-4xl mb-3">🏗️</span>
            <p className="text-sm font-semibold text-gray-600">ยังไม่มีผลการวางแผน</p>
            <p className="text-xs text-gray-400 mt-1">กำหนดชั้นและ Recipe แล้วกดคำนวณ</p>
          </div>
        )}
        {loading && (
          <div className="flex items-center justify-center h-32 rounded-lg bg-indigo-50 border border-indigo-200">
            <span className="text-sm text-indigo-600 font-medium animate-pulse">กำลังคำนวณ…</span>
          </div>
        )}
        {result && !loading && <PlanSummary result={result} />}
      </div>
    </div>
  );
}

// This line intentionally left blank — parseTime helper added above.

// shared/TimeInput.tsx
// กรอกเวลา HH:MM:SS ด้วย spinner แยก 3 ช่อง พร้อม preset buttons

import { useState, useEffect } from 'react';

interface TimeInputProps {
  value: string | null;          // "HH:MM:SS" or null
  onChange: (v: string | null) => void;
  label?: string;
  allowNull?: boolean;           // ถ้า true จะมี checkbox "ไม่มีเวลา"
  presets?: { label: string; value: string }[];
}

function pad(n: number) { return String(Math.max(0, n)).padStart(2, '0'); }

function parse(t: string | null): [number, number, number] {
  if (!t) return [0, 0, 0];
  const parts = t.split(':').map(Number);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

function format(h: number, m: number, s: number): string {
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

// ── Spinner ───────────────────────────────────────────────────────────────────
function Spinner({
  value, min = 0, max, label, onChange,
}: { value: number; min?: number; max: number; label: string; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={() => onChange(value >= max ? min : value + 1)}
        className="w-8 h-6 text-gray-400 hover:text-gray-700 text-sm leading-none select-none"
      >▲</button>
      <input
        type="number" min={min} max={max}
        value={value}
        onChange={(e) => {
          const v = Math.max(min, Math.min(max, Number(e.target.value) || 0));
          onChange(v);
        }}
        className="w-12 rounded border border-gray-300 text-center text-sm py-1 font-mono focus:border-blue-500 focus:outline-none"
      />
      <button
        type="button"
        onClick={() => onChange(value <= min ? max : value - 1)}
        className="w-8 h-6 text-gray-400 hover:text-gray-700 text-sm leading-none select-none"
      >▼</button>
      <span className="text-xs text-gray-400 mt-0.5">{label}</span>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
const DEFAULT_PRESETS = [
  { label: '30 นาที', value: '00:30:00' },
  { label: '1 ชม.',   value: '01:00:00' },
  { label: '2 ชม.',   value: '02:00:00' },
  { label: '4 ชม.',   value: '04:00:00' },
  { label: '6 ชม.',   value: '06:00:00' },
];

export function TimeInput({ value, onChange, label, allowNull = false, presets }: TimeInputProps) {
  const [h, m, s] = parse(value);
  const [isNull, setIsNull] = useState(value === null);

  useEffect(() => { setIsNull(value === null); }, [value]);

  const update = (nh: number, nm: number, ns: number) => {
    onChange(format(nh, nm, ns));
  };

  const showPresets = presets ?? DEFAULT_PRESETS;

  return (
    <div className="space-y-2">
      {label && <p className="text-xs font-medium text-gray-600">{label}</p>}

      {/* Null toggle */}
      {allowNull && (
        <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
          <input
            type="checkbox" checked={isNull}
            onChange={(e) => {
              setIsNull(e.target.checked);
              onChange(e.target.checked ? null : '01:00:00');
            }}
            className="w-3 h-3"
          />
          ไม่มีเวลาแปรรูป (วัตถุดิบดิบ)
        </label>
      )}

      {!isNull && (
        <>
          {/* Spinner row */}
          <div className="flex items-end gap-1">
            <Spinner value={h} min={0} max={99} label="ชม." onChange={(v) => update(v, m, s)} />
            <span className="text-gray-300 text-lg mb-5">:</span>
            <Spinner value={m} min={0} max={59} label="นาที" onChange={(v) => update(h, v, s)} />
            <span className="text-gray-300 text-lg mb-5">:</span>
            <Spinner value={s} min={0} max={59} label="วิ." onChange={(v) => update(h, m, v)} />
            <div className="ml-2 mb-5">
              <span className="text-xs font-mono text-indigo-600 bg-indigo-50 rounded px-2 py-1">
                {format(h, m, s)}
              </span>
            </div>
          </div>

          {/* Preset buttons */}
          <div className="flex flex-wrap gap-1">
            {showPresets.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => onChange(p.value)}
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                  value === p.value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

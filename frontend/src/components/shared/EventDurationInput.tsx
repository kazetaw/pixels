// shared/EventDurationInput.tsx
// กรอกระยะเวลา Event ด้วย preset + spinner วัน/ชม./นาที

import { Dispatch, SetStateAction } from 'react';

interface EventDurationInputProps {
  days: number;
  hours: number;
  minutes: number;
  setDays: Dispatch<SetStateAction<number>>;
  setHours: Dispatch<SetStateAction<number>>;
  setMinutes: Dispatch<SetStateAction<number>>;
}

const PRESETS = [
  { label: '7 วัน',  days: 7,  hours: 0, minutes: 0 },
  { label: '14 วัน', days: 14, hours: 0, minutes: 0 },
  { label: '30 วัน', days: 30, hours: 0, minutes: 0 },
  { label: '60 วัน', days: 60, hours: 0, minutes: 0 },
];

function NumBox({
  value, min = 0, max = 999, label,
  onChange,
}: { value: number; min?: number; max?: number; label: string; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))}
        className="w-8 h-5 text-xs text-gray-400 hover:text-gray-700 select-none leading-none">▲</button>
      <input
        type="number" min={min} max={max} value={value}
        onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || 0)))}
        className="w-14 rounded border border-gray-300 text-center text-sm py-1 font-mono focus:border-blue-500 focus:outline-none"
      />
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))}
        className="w-8 h-5 text-xs text-gray-400 hover:text-gray-700 select-none leading-none">▼</button>
      <span className="text-xs text-gray-400">{label}</span>
    </div>
  );
}

export function EventDurationInput({ days, hours, minutes, setDays, setHours, setMinutes }: EventDurationInputProps) {
  const totalHours = days * 24 + hours + minutes / 60;
  const isPreset = (p: typeof PRESETS[0]) => p.days === days && p.hours === hours && p.minutes === minutes;

  return (
    <div className="space-y-3">
      {/* Preset buttons */}
      <div className="flex flex-wrap gap-1">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => { setDays(p.days); setHours(p.hours); setMinutes(p.minutes); }}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              isPreset(p) ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Spinners */}
      <div className="flex items-end gap-2">
        <NumBox value={days}    min={0} max={365} label="วัน"      onChange={(v) => setDays(v)} />
        <span className="text-gray-300 text-xl mb-5">+</span>
        <NumBox value={hours}   min={0} max={23}  label="ชั่วโมง"  onChange={(v) => setHours(v)} />
        <span className="text-gray-300 text-xl mb-5">+</span>
        <NumBox value={minutes} min={0} max={59}  label="นาที"     onChange={(v) => setMinutes(v)} />
      </div>

      <p className="text-xs text-indigo-600 font-medium">
        รวม {totalHours % 1 === 0 ? totalHours : totalHours.toFixed(2)} ชั่วโมง
      </p>
    </div>
  );
}

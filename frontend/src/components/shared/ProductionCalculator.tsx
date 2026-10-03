import { useState, useMemo } from 'react';
import { InputNumber, Select } from 'antd';
import { ClockCircleOutlined, NumberOutlined } from '@ant-design/icons';
import type { Recipe } from '../../types';

interface Props { recipes: Recipe[] }

function parseSeconds(t: string | null): number {
  if (!t) return 0;
  const [h, m, s] = t.split(':').map(Number);
  return h * 3600 + m * 60 + (s ?? 0);
}

function formatDuration(secs: number): string {
  if (secs <= 0) return '—';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h} ชม.`);
  if (m > 0) parts.push(`${m} นาที`);
  if (s > 0 && h === 0) parts.push(`${s} วินาที`);
  return parts.join(' ') || '0 วินาที';
}

type Mode = 'qty' | 'time';

export function ProductionCalculator({ recipes }: Props) {
  const [mode, setMode] = useState<Mode>('qty');
  const [recipeId, setRecipeId] = useState<string | undefined>();
  const [machines, setMachines] = useState<number | null>(1);
  const [hours, setHours] = useState<number | null>(null);
  const [minutes, setMinutes] = useState<number | null>(null);
  const [quantity, setQuantity] = useState<number | null>(null);

  const options = useMemo(() =>
    recipes
      .filter(r => r.time_per_unit)
      .map(r => ({ value: r.id, label: r.name }))
      .sort((a, b) => a.label.localeCompare(b.label, 'th')),
    [recipes]
  );

  const recipe = recipes.find(r => r.id === recipeId);
  const secPerUnit = parseSeconds(recipe?.time_per_unit ?? null);

  // mode = qty: (machines × total_seconds) / sec_per_unit
  const totalInputSeconds = ((hours ?? 0) * 3600 + (minutes ?? 0) * 60);
  const resultQty = secPerUnit > 0 && (machines ?? 0) > 0 && totalInputSeconds > 0
    ? Math.floor(((machines ?? 1) * totalInputSeconds) / secPerUnit)
    : null;

  // mode = time: (quantity × sec_per_unit) / machines
  const resultSecs = secPerUnit > 0 && (machines ?? 0) > 0 && (quantity ?? 0) > 0
    ? Math.ceil(((quantity ?? 1) * secPerUnit) / (machines ?? 1))
    : null;

  const hasResult = mode === 'qty' ? resultQty !== null : resultSecs !== null;

  return (
    <div className="prod-calc">
      <div className="prod-calc__header">
        <span className="prod-calc__title">คำนวณการผลิต</span>
        <div className="prod-calc__tabs">
          <button className={mode === 'qty' ? 'active' : ''} onClick={() => setMode('qty')} title="กี่ชิ้นใน X เวลา">
            <NumberOutlined /> ชิ้น
          </button>
          <button className={mode === 'time' ? 'active' : ''} onClick={() => setMode('time')} title="ใช้เวลาเท่าไหร่">
            <ClockCircleOutlined /> เวลา
          </button>
        </div>
      </div>

      {/* Recipe picker */}
      <Select
        showSearch
        optionFilterProp="label"
        placeholder="เลือกสูตร…"
        value={recipeId}
        onChange={setRecipeId}
        options={options}
        style={{ width: '100%' }}
        size="small"
      />

      {/* Machines */}
      <div className="prod-calc__row">
        <span>เครื่อง</span>
        <InputNumber
          min={1} max={27} precision={0}
          value={machines} onChange={setMachines}
          size="small" style={{ width: 80 }}
        />
      </div>

      {/* Mode-specific inputs */}
      {mode === 'qty' ? (
        <div className="prod-calc__row">
          <span>เวลา</span>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <InputNumber
              min={0} precision={0}
              value={hours} onChange={setHours}
              placeholder="0" size="small" style={{ width: 52 }}
            />
            <span style={{ fontSize: 11, color: '#64748b' }}>ชม.</span>
            <InputNumber
              min={0} max={59} precision={0}
              value={minutes} onChange={setMinutes}
              placeholder="0" size="small" style={{ width: 52 }}
            />
            <span style={{ fontSize: 11, color: '#64748b' }}>นาที</span>
          </div>
        </div>
      ) : (
        <div className="prod-calc__row">
          <span>จำนวน</span>
          <InputNumber
            min={1} precision={0}
            value={quantity} onChange={setQuantity}
            placeholder="ชิ้น" size="small" style={{ width: 100 }}
            formatter={v => v ? Number(v).toLocaleString('th-TH') : ''}
            parser={v => Number(v?.replace(/[^0-9]/g, '')) as unknown as 0}
          />
        </div>
      )}

      {/* Time per unit display */}
      {recipe && (
        <div className="prod-calc__info">
          {recipe.time_per_unit} / ชิ้น · {formatDuration(secPerUnit)} ต่อชิ้น
        </div>
      )}

      {/* Result */}
      {hasResult && (
        <div className="prod-calc__result">
          {mode === 'qty' ? (
            <>
              <span className="prod-calc__result-num">{(resultQty ?? 0).toLocaleString('th-TH')}</span>
              <span className="prod-calc__result-unit">ชิ้น</span>
              <span className="prod-calc__result-stacks">
                ≈ {Math.floor((resultQty ?? 0) / 99)} กอง + {(resultQty ?? 0) % 99} ชิ้น
              </span>
            </>
          ) : (
            <>
              <span className="prod-calc__result-num" style={{ fontSize: 16 }}>
                {formatDuration(resultSecs ?? 0)}
              </span>
              <span className="prod-calc__result-unit" style={{ fontSize: 11 }}>
                ({(resultSecs ?? 0).toLocaleString('th-TH')} วินาที)
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

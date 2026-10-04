import { useState, useMemo } from 'react';
import { InputNumber, Select } from 'antd';
import { ClockCircleOutlined, NumberOutlined } from '@ant-design/icons';
import { ItemLabel } from './ItemVisual';
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

  // mode = qty: each cycle all machines produce simultaneously
  // cycles = floor(totalInputSeconds / sec_per_unit)
  // qty = cycles × machines
  const totalInputSeconds = ((hours ?? 0) * 3600 + (minutes ?? 0) * 60);
  const resultQty = secPerUnit > 0 && (machines ?? 0) > 0 && totalInputSeconds > 0
    ? Math.floor(totalInputSeconds / secPerUnit) * (machines ?? 1)
    : null;

  // mode = time: cycles = ceil(quantity / machines), time = cycles × sec_per_unit
  const resultSecs = secPerUnit > 0 && (machines ?? 0) > 0 && (quantity ?? 0) > 0
    ? Math.ceil((quantity ?? 1) / (machines ?? 1)) * secPerUnit
    : null;

  const hasResult = mode === 'qty' ? resultQty !== null : resultSecs !== null;

  return (
    <div className="prod-calc">
      <div className="prod-calc__header">
        <span className="prod-calc__title">คำนวณการผลิต</span>
        <div className="prod-calc__tabs" aria-label="วิธีคำนวณ">
          <button className={mode === 'qty' ? 'active' : ''} aria-pressed={mode === 'qty'} onClick={() => setMode('qty')} title="กี่ชิ้นใน X เวลา">
            <NumberOutlined /> ได้กี่ชิ้น
          </button>
          <button className={mode === 'time' ? 'active' : ''} aria-pressed={mode === 'time'} onClick={() => setMode('time')} title="ใช้เวลาเท่าไหร่">
            <ClockCircleOutlined /> ใช้เวลาเท่าไร
          </button>
        </div>
      </div>

      {/* Recipe picker */}
      <label className="prod-calc__field"><span>สินค้าที่ต้องการผลิต</span>
      <Select
        aria-label="สินค้าที่ต้องการผลิต"
        showSearch
        optionFilterProp="label"
        placeholder="ค้นหาชื่อสินค้า…"
        optionRender={option => <ItemLabel id={String(option.value)} name={option.label} image={recipes.find(r => r.id === option.value)?.image} size={28} reserveImage />}
        labelRender={({ value }) => <ItemLabel id={String(value)} name={recipe?.name} image={recipe?.image} size={24} reserveImage />}
        value={recipeId}
        onChange={setRecipeId}
        options={options}
        style={{ width: '100%' }}
        size="large"
      /></label>

      {/* Machines */}
      <div className="prod-calc__row">
        <span>จำนวนเครื่อง</span>
        <InputNumber
          aria-label="จำนวนเครื่อง" min={1} precision={0}
          value={machines} onChange={setMachines}
          size="large" style={{ width: '100%' }}
        />
      </div>

      {/* Mode-specific inputs */}
      {mode === 'qty' ? (
        <div className="prod-calc__row">
          <span>เวลา</span>
          <div className="prod-calc__time-inputs">
            <InputNumber
              aria-label="ชั่วโมงผลิต" min={0} precision={0}
              value={hours} onChange={setHours}
              placeholder="0" size="large" style={{ width: '100%' }}
            />
            <span style={{ fontSize: 11, color: '#64748b' }}>ชม.</span>
            <InputNumber
              aria-label="นาทีผลิต" min={0} max={59} precision={0}
              value={minutes} onChange={setMinutes}
              placeholder="0" size="large" style={{ width: '100%' }}
            />
            <span style={{ fontSize: 11, color: '#64748b' }}>นาที</span>
          </div>
        </div>
      ) : (
        <div className="prod-calc__row">
          <span>จำนวน</span>
          <InputNumber
            aria-label="จำนวนชิ้นที่ต้องการ" min={1} precision={0}
            value={quantity} onChange={setQuantity}
            placeholder="จำนวนชิ้น" size="large" style={{ width: '100%' }}
            formatter={v => v ? Number(v).toLocaleString('th-TH') : ''}
            parser={v => Number(v?.replace(/[^0-9]/g, '')) as unknown as 0}
          />
        </div>
      )}

      {/* Time per unit display */}
      {recipe && (
        <div className="prod-calc__info">
          ผลิต 1 ชิ้น ใช้เวลา {formatDuration(secPerUnit)}
        </div>
      )}

      {!hasResult && <p className="prod-calc__empty">{!recipe ? 'เลือกสินค้าก่อนเริ่มคำนวณ' : mode === 'qty' ? 'กรอกเวลาที่มี เพื่อดูจำนวนชิ้นและกอง' : 'กรอกจำนวนชิ้น เพื่อดูเวลาที่ต้องใช้'}</p>}
      {/* Result */}
      {hasResult && (
        <div className="prod-calc__result">
          {mode === 'qty' ? (() => {
            const qty = resultQty ?? 0;
            const cycles = totalInputSeconds > 0 && secPerUnit > 0 ? Math.floor(totalInputSeconds / secPerUnit) : 0;
            const stacks = Math.floor(qty / 99);
            const rem = qty % 99;
            return (
              <>
                <div className="prod-calc__result-stacks-row">
                  <span className="prod-calc__result-num">{stacks.toLocaleString('th-TH')}</span>
                  <span className="prod-calc__result-unit">กอง</span>
                  {rem > 0 && <span className="prod-calc__result-rem">+ {rem} ชิ้น</span>}
                </div>
                <span className="prod-calc__result-total">รวม {qty.toLocaleString('th-TH')} ชิ้น · {cycles} รอบผลิต</span>
              </>
            );
          })() : (() => {
            const cycles = (machines ?? 0) > 0 && (quantity ?? 0) > 0 ? Math.ceil((quantity ?? 1) / (machines ?? 1)) : 0;
            return (
              <>
                <span className="prod-calc__result-num" style={{ fontSize: 16 }}>
                  {formatDuration(resultSecs ?? 0)}
                </span>
                <span className="prod-calc__result-total">{cycles} รอบผลิต · {cycles} × {formatDuration(secPerUnit)}</span>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}

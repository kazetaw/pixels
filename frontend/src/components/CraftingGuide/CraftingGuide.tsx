/**
 * CraftingGuide.tsx — 4-step crafting guide
 * Step 4 shows a clear dependency chain:
 *   "ขั้นนี้ใช้อะไร → ได้อะไร → ส่งไปขั้นไหน"
 */
import { useMemo, useState } from 'react';
import { Input, Empty, message } from 'antd';
import { SearchOutlined, InboxOutlined, CopyOutlined } from '@ant-design/icons';
import type { Recipe, Machine, StockMap, StockImageMap } from '../../types';
import './CraftingGuide.css';

// ── helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number) { return n.toLocaleString('th-TH'); }

function parseTime(t: string | null): string {
  if (!t) return '—';
  const [h, m] = t.split(':').map(Number);
  if (h > 0 && m > 0) return `${h} ชม. ${m} น.`;
  if (h > 0) return `${h} ชม.`;
  return `${m} น.`;
}

// ── types ─────────────────────────────────────────────────────────────────────
type IngRow = {
  itemId: string;
  name: string;
  qty: number;
  isCraftable: boolean;
};

/** One node in the execution plan */
type StepNode = {
  order: number;
  recipeId: string;
  name: string;
  qty: number;
  machineId: string | null;
  timePerUnit: string | null;
  isGoal: boolean;
  /** direct ingredients of THIS step only (not expanded) */
  inputs: { itemId: string; name: string; qty: number; isCraftable: boolean }[];
  /** name of the parent step that consumes this output */
  usedBy: string | null;
};

// ── flat ingredient list (deep — for step 3) ──────────────────────────────────
function resolveIngredients(
  recipeId: string,
  qty: number,
  recipes: Recipe[],
  itemNames: Record<string, string>,
  acc: Map<string, IngRow> = new Map(),
): IngRow[] {
  const recipe = recipes.find(r => r.id === recipeId);
  if (!recipe) return [];
  for (const [itemId, need] of Object.entries(recipe.ingredients)) {
    const subRecipe = recipes.find(r => r.id === itemId);
    if (subRecipe) {
      resolveIngredients(itemId, need * qty, recipes, itemNames, acc);
    } else {
      const prev = acc.get(itemId);
      acc.set(itemId, {
        itemId,
        name: itemNames[itemId] ?? itemId,
        qty: (prev?.qty ?? 0) + need * qty,
        isCraftable: false,
      });
    }
  }
  return Array.from(acc.values());
}

// ── build ordered step list with per-step inputs + usedBy ────────────────────
function buildSteps(
  recipeId: string,
  qty: number,
  recipes: Recipe[],
  itemNames: Record<string, string>,
  usedBy: string | null,
  visited: Map<string, number> = new Map(),
): Omit<StepNode, 'order'>[] {
  const recipe = recipes.find(r => r.id === recipeId);
  if (!recipe) return [];

  // deduplicate: if already queued, just accumulate qty
  if (visited.has(recipeId)) return [];
  visited.set(recipeId, qty);

  const steps: Omit<StepNode, 'order'>[] = [];

  // recurse into sub-recipes first (depth-first = correct order)
  for (const [itemId, need] of Object.entries(recipe.ingredients)) {
    const subRecipe = recipes.find(r => r.id === itemId);
    if (subRecipe) {
      steps.push(...buildSteps(itemId, need * qty, recipes, itemNames, recipe.name, visited));
    }
  }

  // inputs for THIS step only
  const inputs = Object.entries(recipe.ingredients).map(([itemId, need]) => ({
    itemId,
    name: itemNames[itemId] ?? itemId,
    qty: need * qty,
    isCraftable: !!recipes.find(r => r.id === itemId),
  }));

  steps.push({
    recipeId,
    name: recipe.name,
    qty,
    machineId: recipe.machine_id,
    timePerUnit: recipe.time_per_unit,
    isGoal: false,
    inputs,
    usedBy,
  });

  return steps;
}

// ── sub-components ────────────────────────────────────────────────────────────
function StepIndicator({ step }: { step: number }) {
  const labels = ['เลือกสูตร', 'กำหนดจำนวน', 'วัตถุดิบ', 'ขั้นตอน'];
  return (
    <div className="cg-steps">
      {labels.map((label, i) => {
        const n = i + 1;
        const state = n < step ? 'done' : n === step ? 'active' : 'todo';
        return (
          <div key={n} className="cg-step-wrap">
            <div className={`cg-step-num cg-step-num--${state}`}>{state === 'done' ? '✓' : n}</div>
            <span className={`cg-step-label cg-step-label--${state}`}>{label}</span>
            {i < labels.length - 1 && <span className="cg-step-arrow">›</span>}
          </div>
        );
      })}
    </div>
  );
}

function ItemImg({ src, name, size = 32 }: { src?: string | null; name: string; size?: number }) {
  return (
    <span className="cg-item-img" style={{ width: size, height: size }}>
      {src ? <img src={src} alt={name} loading="lazy" /> : <InboxOutlined style={{ fontSize: size * 0.5 }} />}
    </span>
  );
}

// ── main ──────────────────────────────────────────────────────────────────────
interface Props {
  recipes: Recipe[];
  machines: Machine[];
  stocks: StockMap;
  stockImages: StockImageMap;
  itemNames: Record<string, string>;
}

export function CraftingGuide({ recipes, machines, stocks, stockImages, itemNames }: Props) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [step, setStep] = useState(1);
  const [msgApi, msgCtx] = message.useMessage();

  const machineMap = useMemo(() => new Map(machines.map(m => [m.machine_id, m])), [machines]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return q ? recipes.filter(r => r.name.toLowerCase().includes(q)) : recipes;
  }, [recipes, query]);

  const selected = useMemo(() => recipes.find(r => r.id === selectedId) ?? null, [recipes, selectedId]);

  // deep flat ingredients (for step 3)
  const ingredients = useMemo(() => {
    if (!selectedId) return [];
    return resolveIngredients(selectedId, qty, recipes, itemNames);
  }, [selectedId, qty, recipes, itemNames]);

  // ordered steps with per-step context (for step 4)
  const steps: StepNode[] = useMemo(() => {
    if (!selectedId) return [];
    const raw = buildSteps(selectedId, qty, recipes, itemNames, null, new Map());
    const numbered = raw.map((s, i) => ({ ...s, order: i + 1 }));
    if (numbered.length > 0) numbered[numbered.length - 1].isGoal = true;
    return numbered;
  }, [selectedId, qty, recipes, itemNames]);

  const selectRecipe = (id: string) => { setSelectedId(id); setQty(1); setStep(2); };
  const machine = selected ? machineMap.get(selected.machine_id ?? '') : null;

  // ── Copy TSV for Google Sheet ─────────────────────────────────────────────
  const copyToSheet = () => {
    if (!selected) return;
    const header = ['✓', 'วัตถุดิบ', 'ต้องการ', 'มีในสต็อก', 'ขาด', 'หมายเหตุ'];
    const rows = ingredients.map(ing => {
      const have = stocks[ing.itemId] ?? 0;
      const short = Math.max(0, ing.qty - have);
      return [
        have >= ing.qty ? '✅' : '❌',
        ing.name,
        ing.qty.toString(),
        have.toString(),
        short > 0 ? short.toString() : '',
        '',
      ];
    });
    const total = ingredients.reduce((s, i) => s + i.qty, 0);
    const separator = ['', '', '', '', '', ''];
    const footer = ['', `รวม (${selected.name} ×${qty})`, total.toString(), '', '', ''];

    const tsv = [header, ...rows, separator, footer]
      .map(r => r.join('\t'))
      .join('\n');

    navigator.clipboard.writeText(tsv)
      .then(() => void msgApi.success('คัดลอกแล้ว — วางใน Google Sheet ได้เลย'))
      .catch(() => void msgApi.error('คัดลอกไม่สำเร็จ'));
  };

  return (
    <div className="cg-page">
      {msgCtx}
      <div className="cg-header">
        <h1>🧪 ไกด์การคราฟ</h1>
        <p>ค้นหาสูตร กำหนดจำนวน ดูขั้นตอนและวัตถุดิบที่ต้องเตรียม</p>
      </div>

      <StepIndicator step={step} />

      {/* ── Step 1 ── */}
      {step === 1 && (
        <div className="cg-step-panel">
          <Input prefix={<SearchOutlined />} placeholder="ค้นหาสูตรคราฟ…"
            value={query} onChange={e => setQuery(e.target.value)} allowClear size="large" className="cg-search" />
          {filtered.length === 0 && <Empty description="ไม่พบสูตร" style={{ padding: '40px 0' }} />}
          <div className="cg-recipe-grid">
            {filtered.map(r => {
              const m = machineMap.get(r.machine_id ?? '');
              return (
                <button key={r.id} className="cg-recipe-card" onClick={() => selectRecipe(r.id)}>
                  <div className="cg-recipe-card__head">
                    <ItemImg src={r.image ?? stockImages[r.id]} name={r.name} size={40} />
                    <div>
                      <div className="cg-recipe-card__name">{r.name}</div>
                      <div className="cg-recipe-card__meta">{m ? m.machine_name : '—'} · {parseTime(r.time_per_unit)}</div>
                    </div>
                  </div>
                  <div className="cg-recipe-card__tags">
                    {m?.occupation && <span className="cg-tag cg-tag--blue">{m.occupation}</span>}
                    <span className="cg-tag cg-tag--green">{Object.keys(r.ingredients).length} วัตถุดิบ</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Steps 2–4 ── */}
      {step >= 2 && selected && (
        <>
          <div className="cg-detail-header">
            <ItemImg src={selected.image ?? stockImages[selected.id]} name={selected.name} size={52} />
            <div className="cg-detail-header__info">
              <div className="cg-detail-header__name">{selected.name}</div>
              <div className="cg-detail-header__meta">{machine ? machine.machine_name : '—'} · {parseTime(selected.time_per_unit)}</div>
            </div>
            <button className="cg-back-btn" onClick={() => { setStep(1); setSelectedId(null); }}>← เปลี่ยนสูตร</button>
          </div>

          <div className="cg-tabs">
            {[{ n: 2, label: 'จำนวน' }, { n: 3, label: 'วัตถุดิบ' }, { n: 4, label: 'ขั้นตอน' }].map(t => (
              <button key={t.n} className={`cg-tab${step === t.n ? ' is-active' : ''}`} onClick={() => setStep(t.n)}>
                {t.n - 1}. {t.label}
              </button>
            ))}
          </div>

          {/* Step 2 */}
          {step === 2 && (
            <div className="cg-body">
              <div className="cg-qty-row">
                <span className="cg-qty-label">ต้องการกี่ชิ้น?</span>
                <div className="cg-qty-ctrl">
                  {[1, 5, 10, 20, 50].map(n => (
                    <button key={n} className={`cg-preset${qty === n ? ' is-active' : ''}`} onClick={() => setQty(n)}>{n}</button>
                  ))}
                  <button className="cg-qty-btn" onClick={() => setQty(q => Math.max(1, q - 1))}>−</button>
                  <input className="cg-qty-val" type="number" min={1} value={qty}
                    onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 1) setQty(v); }}
                    onFocus={e => e.target.select()} />
                  <button className="cg-qty-btn" onClick={() => setQty(q => q + 1)}>+</button>
                </div>
              </div>
              <div className="cg-summary-box">
                <div className="cg-summary-row"><span>จำนวนรอบ</span><span>{fmt(qty)} รอบ</span></div>
                <div className="cg-summary-row">
                  <span>เวลารวม</span>
                  <span>{selected.time_per_unit ? (() => {
                    const [h, m] = selected.time_per_unit.split(':').map(Number);
                    const total = (h * 60 + m) * qty;
                    return total >= 60 ? `${Math.floor(total / 60)} ชม. ${total % 60} น.` : `${total} น.`;
                  })() : '—'}</span>
                </div>
                <div className="cg-summary-row cg-summary-row--total">
                  <span>วัตถุดิบพื้นฐานทั้งหมด</span>
                  <span>{fmt(ingredients.reduce((s, i) => s + i.qty, 0))} ชิ้น</span>
                </div>
              </div>
              <button className="cg-btn-primary" onClick={() => setStep(3)}>ดูวัตถุดิบที่ต้องใช้ →</button>
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div className="cg-body">
              <div className="cg-section-header">
                <p className="cg-section-title">วัตถุดิบพื้นฐานทั้งหมดที่ต้องใช้ (×{fmt(qty)})</p>
                <button className="cg-copy-btn" onClick={copyToSheet}>
                  <CopyOutlined /> คัดลอกเป็น Sheet
                </button>
              </div>
              <div className="cg-ing-list">
                {ingredients.map(ing => {
                  const have = stocks[ing.itemId] ?? 0;
                  const pct = Math.min(100, ing.qty > 0 ? have / ing.qty * 100 : 0);
                  const ok = have >= ing.qty;
                  return (
                    <div key={ing.itemId} className="cg-ing-row">
                      <ItemImg src={stockImages[ing.itemId]} name={ing.name} size={32} />
                      <div className="cg-ing-row__info">
                        <div className="cg-ing-row__name">{ing.name}</div>
                        <div className="cg-ing-row__progress">
                          <div className="cg-progress">
                            <div className={`cg-progress-bar${ok ? ' is-ok' : ''}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className={`cg-ing-row__stock${ok ? ' is-ok' : ' is-short'}`}>{fmt(have)}/{fmt(ing.qty)}</span>
                        </div>
                      </div>
                      <span className="cg-ing-row__qty">×{fmt(ing.qty)}</span>
                    </div>
                  );
                })}
              </div>
              <button className="cg-btn-primary" onClick={() => setStep(4)}>ดูลำดับขั้นตอน →</button>
            </div>
          )}

          {/* Step 4 — dependency chain */}
          {step === 4 && (
            <div className="cg-body">
              <p className="cg-section-title">ลำดับการคราฟ — ทำตามข้อ 1, 2, 3… ตามลำดับ</p>
              <div className="cg-step-path">
                {steps.map((s, i) => {
                  const m = machineMap.get(s.machineId ?? '');
                  const isLast = i === steps.length - 1;
                  return (
                    <div key={`${s.recipeId}-${i}`} className="cg-step-node">
                      <div className="cg-step-line">
                        <div className={`cg-step-dot${s.isGoal ? ' is-goal' : ''}`}>{s.order}</div>
                        {!isLast && <div className="cg-step-connector" />}
                      </div>
                      <div className="cg-step-content">
                        {/* header */}
                        <div className="cg-step-content__head">
                          <ItemImg src={stockImages[s.recipeId]} name={s.name} size={28} />
                          <span className="cg-step-content__name">{s.name}</span>
                          <span className="cg-step-content__qty">×{fmt(s.qty)}</span>
                        </div>

                        {/* machine + time tags */}
                        <div className="cg-step-content__meta">
                          {m && <span className="cg-tag cg-tag--purple">{m.machine_name}</span>}
                          {s.timePerUnit && <span className="cg-tag cg-tag--orange">⏱ {parseTime(s.timePerUnit)}/รอบ</span>}
                          {s.isGoal && <span className="cg-tag cg-tag--blue">🎯 เป้าหมาย</span>}
                        </div>

                        {/* inputs: วัตถุดิบที่ขั้นนี้ใช้ */}
                        <div className="cg-step-inputs">
                          <span className="cg-step-inputs__label">ใช้:</span>
                          {s.inputs.map(inp => (
                            <span key={inp.itemId} className={`cg-step-chip${inp.isCraftable ? ' is-craft' : ''}`}>
                              <ItemImg src={stockImages[inp.itemId]} name={inp.name} size={16} />
                              {inp.name} ×{fmt(inp.qty)}
                              {inp.isCraftable && <span className="cg-chip-craft-mark">↑ คราฟ</span>}
                            </span>
                          ))}
                        </div>

                        {/* usedBy: ผลไปใช้ที่ขั้นไหน */}
                        {s.usedBy && (
                          <div className="cg-step-usedby">
                            ↳ ผลลัพธ์ไปใช้ใน: <strong>{s.usedBy}</strong>
                          </div>
                        )}

                        {s.isGoal && (
                          <div className="cg-step-goal-box">✓ ได้ {selected.name} {fmt(s.qty)} ชิ้น</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * CraftingGuide.tsx
 *
 * 4-step crafting guide:
 *   1. เลือกสูตร
 *   2. กำหนดจำนวน
 *   3. วัตถุดิบที่ต้องใช้ (เทียบสต็อก)
 *   4. ลำดับขั้นตอน (dependency tree)
 */
import { useMemo, useState } from 'react';
import { Input, Empty } from 'antd';
import { SearchOutlined, InboxOutlined } from '@ant-design/icons';
import type { Recipe, Machine, StockMap, StockImageMap } from '../../types';
import './CraftingGuide.css';

// ── helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number) { return n.toLocaleString('th-TH'); }

function parseTime(t: string | null): string {
  if (!t) return '—';
  const [h, m] = t.split(':').map(Number);
  if (h > 0 && m > 0) return `${h} ชม. ${m} น.`;
  if (h > 0) return `${h} ชม.`;
  return `${m} น.`;
}

/** Resolve flat ingredient list for qty units of recipe, expanding sub-recipes */
type IngRow = { itemId: string; name: string; qty: number; isCraftable: boolean; recipeId?: string };

function resolveIngredients(
  recipeId: string,
  qty: number,
  recipes: Recipe[],
  itemNames: Record<string, string>,
  visited = new Set<string>(),
): IngRow[] {
  const recipe = recipes.find(r => r.id === recipeId);
  if (!recipe) return [];
  const rows: IngRow[] = [];
  for (const [itemId, need] of Object.entries(recipe.ingredients)) {
    const subRecipe = recipes.find(r => r.id === itemId || r.name === itemNames[itemId]);
    const isCraftable = !!subRecipe && !visited.has(itemId);
    rows.push({
      itemId,
      name: itemNames[itemId] ?? itemId,
      qty: need * qty,
      isCraftable,
      recipeId: isCraftable ? subRecipe!.id : undefined,
    });
  }
  return rows;
}

/** Build ordered step list: deepest dependencies first */
type StepNode = { order: number; recipeId: string; name: string; qty: number; machineId: string | null; timePerUnit: string | null; isGoal: boolean };

function buildSteps(
  recipeId: string,
  qty: number,
  recipes: Recipe[],
  itemNames: Record<string, string>,
  visited = new Set<string>(),
): StepNode[] {
  if (visited.has(recipeId)) return [];
  visited.add(recipeId);
  const recipe = recipes.find(r => r.id === recipeId);
  if (!recipe) return [];

  const steps: StepNode[] = [];
  for (const [itemId] of Object.entries(recipe.ingredients)) {
    const subRecipe = recipes.find(r => r.id === itemId);
    if (subRecipe) {
      const subQty = (recipe.ingredients[itemId] ?? 1) * qty;
      steps.push(...buildSteps(subRecipe.id, subQty, recipes, itemNames, visited));
    }
  }
  steps.push({ order: 0, recipeId, name: recipe.name, qty, machineId: recipe.machine_id, timePerUnit: recipe.time_per_unit, isGoal: false });
  return steps.map((s, i) => ({ ...s, order: i + 1 }));
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

// ── main component ────────────────────────────────────────────────────────────
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

  const machineMap = useMemo(() => new Map(machines.map(m => [m.machine_id, m])), [machines]);

  // Step 1: filtered recipes
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return q ? recipes.filter(r => r.name.toLowerCase().includes(q)) : recipes;
  }, [recipes, query]);

  const selected = useMemo(() => recipes.find(r => r.id === selectedId) ?? null, [recipes, selectedId]);

  // Step 3: flat ingredients
  const ingredients = useMemo(() => {
    if (!selectedId) return [];
    return resolveIngredients(selectedId, qty, recipes, itemNames);
  }, [selectedId, qty, recipes, itemNames]);

  // Step 4: ordered steps
  const steps = useMemo(() => {
    if (!selectedId) return [];
    const s = buildSteps(selectedId, qty, recipes, itemNames, new Set());
    if (s.length > 0) s[s.length - 1].isGoal = true;
    return s;
  }, [selectedId, qty, recipes, itemNames]);

  const selectRecipe = (id: string) => {
    setSelectedId(id);
    setQty(1);
    setStep(2);
  };

  const machine = selected ? machineMap.get(selected.machine_id ?? '') : null;

  return (
    <div className="cg-page">
      <div className="cg-header">
        <h1>🧪 ไกด์การคราฟ</h1>
        <p>ค้นหาสูตร กำหนดจำนวน ดูขั้นตอนและวัตถุดิบที่ต้องเตรียม</p>
      </div>

      <StepIndicator step={step} />

      {/* ── Step 1: เลือกสูตร ── */}
      {step === 1 && (
        <div className="cg-step-panel">
          <Input
            prefix={<SearchOutlined />}
            placeholder="ค้นหาสูตรคราฟ…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            allowClear
            size="large"
            className="cg-search"
          />
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
                      <div className="cg-recipe-card__meta">
                        {m ? m.machine_name : '—'} · {parseTime(r.time_per_unit)}
                      </div>
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

      {/* ── Steps 2–4: selected recipe ── */}
      {step >= 2 && selected && (
        <>
          {/* recipe header */}
          <div className="cg-detail-header">
            <ItemImg src={selected.image ?? stockImages[selected.id]} name={selected.name} size={52} />
            <div className="cg-detail-header__info">
              <div className="cg-detail-header__name">{selected.name}</div>
              <div className="cg-detail-header__meta">
                {machine ? machine.machine_name : '—'} · {parseTime(selected.time_per_unit)}
              </div>
            </div>
            <button className="cg-back-btn" onClick={() => { setStep(1); setSelectedId(null); }}>← เปลี่ยนสูตร</button>
          </div>

          {/* Step tabs */}
          <div className="cg-tabs">
            {[
              { n: 2, label: 'จำนวน' },
              { n: 3, label: 'วัตถุดิบ' },
              { n: 4, label: 'ขั้นตอน' },
            ].map(t => (
              <button key={t.n} className={`cg-tab${step === t.n ? ' is-active' : ''}`} onClick={() => setStep(t.n)}>
                {t.n - 1}. {t.label}
              </button>
            ))}
          </div>

          {/* ── Step 2: กำหนดจำนวน ── */}
          {step === 2 && (
            <div className="cg-body">
              <div className="cg-qty-row">
                <span className="cg-qty-label">ต้องการกี่ชิ้น?</span>
                <div className="cg-qty-ctrl">
                  {[1, 5, 10, 20, 50].map(n => (
                    <button key={n} className={`cg-preset${qty === n ? ' is-active' : ''}`} onClick={() => setQty(n)}>{n}</button>
                  ))}
                  <button className="cg-qty-btn" onClick={() => setQty(q => Math.max(1, q - 1))}>−</button>
                  <input
                    className="cg-qty-val"
                    type="number"
                    min={1}
                    value={qty}
                    onChange={e => {
                      const v = parseInt(e.target.value, 10);
                      if (!isNaN(v) && v >= 1) setQty(v);
                    }}
                    onFocus={e => e.target.select()}
                  />
                  <button className="cg-qty-btn" onClick={() => setQty(q => q + 1)}>+</button>
                </div>
              </div>

              <div className="cg-summary-box">
                <div className="cg-summary-row">
                  <span>จำนวนรอบ</span>
                  <span>{fmt(qty)} รอบ</span>
                </div>
                <div className="cg-summary-row">
                  <span>เวลารวม</span>
                  <span>
                    {selected.time_per_unit
                      ? (() => {
                          const [h, m] = selected.time_per_unit.split(':').map(Number);
                          const total = (h * 60 + m) * qty;
                          return total >= 60 ? `${Math.floor(total / 60)} ชม. ${total % 60} น.` : `${total} น.`;
                        })()
                      : '—'}
                  </span>
                </div>
                <div className="cg-summary-row cg-summary-row--total">
                  <span>วัตถุดิบทั้งหมด</span>
                  <span>{fmt(Object.values(selected.ingredients).reduce((s, v) => s + v * qty, 0))} ชิ้น</span>
                </div>
              </div>

              <button className="cg-btn-primary" onClick={() => setStep(3)}>ดูวัตถุดิบที่ต้องใช้ →</button>
            </div>
          )}

          {/* ── Step 3: วัตถุดิบ ── */}
          {step === 3 && (
            <div className="cg-body">
              <p className="cg-section-title">วัตถุดิบที่ต้องใช้ทั้งหมด (×{fmt(qty)})</p>
              <div className="cg-ing-list">
                {ingredients.map(ing => {
                  const have = stocks[ing.itemId] ?? 0;
                  const pct = Math.min(100, have / ing.qty * 100);
                  const ok = have >= ing.qty;
                  return (
                    <div key={ing.itemId} className={`cg-ing-row${ing.isCraftable ? ' is-craftable' : ''}`}>
                      <ItemImg src={stockImages[ing.itemId]} name={ing.name} size={32} />
                      <div className="cg-ing-row__info">
                        <div className="cg-ing-row__name">
                          {ing.name}
                          {ing.isCraftable && <span className="cg-craftable-tag">คราฟได้ →</span>}
                        </div>
                        <div className="cg-ing-row__progress">
                          <div className="cg-progress">
                            <div className={`cg-progress-bar${ok ? ' is-ok' : ''}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className={`cg-ing-row__stock${ok ? ' is-ok' : ' is-short'}`}>
                            {fmt(have)}/{fmt(ing.qty)}
                          </span>
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

          {/* ── Step 4: ขั้นตอน ── */}
          {step === 4 && (
            <div className="cg-body">
              <p className="cg-section-title">ลำดับที่ต้องคราฟ — เริ่มจากข้อ 1</p>
              <div className="cg-step-path">
                {steps.map((s, i) => {
                  const m = machineMap.get(s.machineId ?? '');
                  const isLast = i === steps.length - 1;
                  return (
                    <div key={s.recipeId} className="cg-step-node">
                      <div className="cg-step-line">
                        <div className={`cg-step-dot${s.isGoal ? ' is-goal' : ''}`}>{s.order}</div>
                        {!isLast && <div className="cg-step-connector" />}
                      </div>
                      <div className="cg-step-content">
                        <div className="cg-step-content__head">
                          <ItemImg src={stockImages[s.recipeId]} name={s.name} size={28} />
                          <span className="cg-step-content__name">{s.name}</span>
                          <span className="cg-step-content__qty">×{fmt(s.qty)}</span>
                        </div>
                        <div className="cg-step-content__meta">
                          {m && <span className="cg-tag cg-tag--purple">{m.machine_name}</span>}
                          {s.timePerUnit && <span className="cg-tag cg-tag--orange">{parseTime(s.timePerUnit)}/รอบ</span>}
                          {s.isGoal && <span className="cg-tag cg-tag--blue">🎯 เป้าหมาย</span>}
                        </div>
                        {s.isGoal && (
                          <div className="cg-step-goal-box">
                            <span>✓ ได้ {selected.name} {fmt(s.qty)} ชิ้น</span>
                          </div>
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

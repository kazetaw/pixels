import { useState, useCallback, useEffect, useRef } from 'react';
import { Recipe, Machine, StockMap, StockImageMap, AppData } from '../../types';
import { fetchAllData } from '../../api/client';
import { LockOutlined } from '@ant-design/icons';
import { RecipeEditor } from './RecipeEditor';
import { StockEditorFull } from './StockEditorFull';
import { MachineEditor } from './MachineEditor';
import { BudgetDraft } from './BudgetDraft';

interface DataEditorProps {
  initialRecipes: Recipe[];
  initialMachines: Machine[];
  initialStocks: StockMap;
  initialStockImages: StockImageMap;
  onDataChanged: (data: AppData) => void;
}

type DataTab = 'recipes' | 'machines' | 'stocks' | 'budget';

export function DataEditor({ initialRecipes, initialMachines, initialStocks, initialStockImages, onDataChanged }: DataEditorProps) {
  const [tab, setTab] = useState<DataTab>('recipes');
  const [recipes, setRecipes] = useState<Recipe[]>(initialRecipes);
  const [machines, setMachines] = useState<Machine[]>(initialMachines);
  const [stocks, setStocks] = useState<StockMap>(initialStocks);
  const [stockImages, setStockImages] = useState<StockImageMap>(initialStockImages);
  const [reloading, setReloading] = useState(false);

  // ── Budget PIN lock ────────────────────────────────────────────────────────
  const BUDGET_PIN = '7774';
  const PIN_LENGTH = 4;
  const [budgetUnlocked, setBudgetUnlocked] = useState(false);
  const [pinDigits, setPinDigits] = useState<string[]>(['', '', '', '']);
  const [pinError, setPinError] = useState(false);
  const pinRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handlePinDigit = (index: number, value: string) => {
    // รับเฉพาะตัวเลข
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...pinDigits];
    next[index] = digit;
    setPinDigits(next);
    setPinError(false);

    if (digit && index < PIN_LENGTH - 1) {
      pinRefs.current[index + 1]?.focus();
    }

    // ตรวจสอบ PIN อัตโนมัติเมื่อกรอกครบ
    if (digit && index === PIN_LENGTH - 1) {
      const entered = [...next].join('');
      if (entered === BUDGET_PIN) {
        setBudgetUnlocked(true);
        setPinDigits(['', '', '', '']);
      } else {
        setPinError(true);
        setTimeout(() => {
          setPinDigits(['', '', '', '']);
          setPinError(false);
          pinRefs.current[0]?.focus();
        }, 600);
      }
    }
  };

  const handlePinKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pinDigits[index] && index > 0) {
      pinRefs.current[index - 1]?.focus();
    }
  };

  // App data can arrive after this editor first mounts when Backend starts later.
  useEffect(() => {
    setRecipes(initialRecipes);
    setMachines(initialMachines);
    setStocks(initialStocks);
    setStockImages(initialStockImages);
  }, [initialRecipes, initialMachines, initialStocks, initialStockImages]);

  const reload = useCallback(async () => {
    setReloading(true);
    try {
      const data = await fetchAllData();
      setRecipes(data.recipes);
      setMachines(data.machines);
      setStocks(data.stocks);
      setStockImages(data.stockImages ?? {});
      onDataChanged(data);
    } finally {
      setReloading(false);
    }
  }, [onDataChanged]);

  const tabs: { key: DataTab; label: string }[] = [
    { key: 'recipes',  label: 'สูตรการผลิต' },
    { key: 'machines', label: 'เครื่องจักร' },
    { key: 'stocks',   label: 'สต็อกวัตถุดิบ' },
    { key: 'budget',   label: 'งบประมาณ' },
  ];

  return (
    <div>
      {/* Sub-tabs */}
      <nav className="tab-nav">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={tab === key ? 'active' : ''}
          >
            {label}
            {reloading && tab === key && (
              <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 6 }}>โหลด…</span>
            )}
          </button>
        ))}
      </nav>

      {/* Content */}
      {tab === 'recipes' && (
        <RecipeEditor
          recipes={recipes}
          machines={machines}
          stocks={stocks}
          onChange={reload}
        />
      )}

      {tab === 'machines' && (
        <MachineEditor
          machines={machines}
          recipes={recipes}
          stocks={stocks}
          onChange={reload}
        />
      )}

      {tab === 'stocks' && (
        <StockEditorFull
          stocks={stocks}
          stockImages={stockImages}
          recipes={recipes}
          machines={machines}
          onSaved={(newStocks, newImages) => {
            setStocks(newStocks);
            setStockImages(newImages);
            onDataChanged({ recipes, machines, stocks: newStocks, stockImages: newImages });
          }}
          onRecipeImageChanged={(updatedRecipe) => {
            const nextRecipes = recipes.map((recipe) => recipe.id === updatedRecipe.id ? updatedRecipe : recipe);
            setRecipes(nextRecipes);
            onDataChanged({ recipes: nextRecipes, machines, stocks, stockImages });
          }}
        />
      )}

      {tab === 'budget' && (
        budgetUnlocked
          ? <BudgetDraft stocks={stocks} recipes={recipes} onStockChanged={reload} />
          : (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', padding: '72px 24px', gap: 20,
            }}>
              <LockOutlined style={{ fontSize: 32, color: '#94a3b8' }} />
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontWeight: 600, fontSize: 15, color: '#0f172a', margin: 0 }}>งบประมาณ</p>
                <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>ใส่ PIN เพื่อเข้าดู</p>
              </div>

              {/* 4-dot PIN circles */}
              <div style={{ display: 'flex', gap: 14 }}>
                {pinDigits.map((digit, i) => (
                  <div key={i} style={{ position: 'relative', width: 52, height: 52 }}>
                    <input
                      ref={(el) => { pinRefs.current[i] = el; }}
                      type="password"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      autoFocus={i === 0}
                      onChange={(e) => handlePinDigit(i, e.target.value)}
                      onKeyDown={(e) => handlePinKeyDown(i, e)}
                      style={{
                        position: 'absolute', inset: 0,
                        width: '100%', height: '100%',
                        opacity: 0, cursor: 'text',
                        zIndex: 1,
                      }}
                    />
                    {/* วงกลมแสดงผล */}
                    <div style={{
                      width: 52, height: 52,
                      borderRadius: '50%',
                      border: `2px solid ${pinError ? '#ef4444' : digit ? '#2563eb' : '#cbd5e1'}`,
                      background: pinError ? '#fef2f2' : digit ? '#eff6ff' : '#f8fafc',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'border-color 0.15s, background 0.15s',
                    }}>
                      {digit && (
                        <div style={{
                          width: 12, height: 12,
                          borderRadius: '50%',
                          background: pinError ? '#ef4444' : '#2563eb',
                          transition: 'background 0.15s',
                        }} />
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {pinError && (
                <p style={{ fontSize: 12, color: '#ef4444', margin: 0 }}>PIN ไม่ถูกต้อง</p>
              )}
            </div>
          )
      )}
    </div>
  );
}

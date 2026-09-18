import { useState } from 'react';
import { Recipe, Machine, StockMap } from '../../types';
import { createRecipe, updateRecipe, deleteRecipe } from '../../api/client';
import { TimeInput } from '../shared/TimeInput';

interface RecipeEditorProps {
  recipes: Recipe[];
  machines: Machine[];
  stocks: StockMap;
  onChange: () => void;
}

// ── Ingredient row editor ─────────────────────────────────────────────────────

interface IngEditorProps {
  ingredients: Record<string, number>;
  recipes: Recipe[];
  stocks: StockMap;
  onChange: (ing: Record<string, number>) => void;
}

function IngredientEditor({ ingredients, recipes, stocks, onChange }: IngEditorProps) {
  const [query, setQuery] = useState('');
  const [qty, setQty] = useState('1');
  const [showSugg, setShowSugg] = useState(false);

  // Build suggestion list: recipes first, then raw materials
  const recipeOptions = recipes.map((r) => ({ key: r.id, label: r.name, type: 'recipe' as const }));
  const recipeIds = new Set(recipes.map((r) => r.id));
  const rawOptions = Object.keys(stocks)
    .filter((k) => !recipeIds.has(k))
    .map((k) => ({ key: k, label: k, type: 'raw' as const }));
  const allOptions = [...recipeOptions, ...rawOptions];

  const suggestions = query.trim()
    ? allOptions.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : allOptions;

  // resolved key: if user picked from list selectedKey is set, else query is used as-is
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const effectiveKey = selectedKey ?? (query.trim() || null);

  const handleSelect = (opt: typeof allOptions[0]) => {
    setSelectedKey(opt.key);
    setQuery(opt.label);
    setShowSugg(false);
  };

  const handleQueryChange = (v: string) => {
    setQuery(v);
    setSelectedKey(null);
    setShowSugg(true);
  };

  const add = () => {
    const k = (effectiveKey ?? '').trim();
    const q = Number(qty);
    if (!k || q <= 0) return;
    onChange({ ...ingredients, [k]: q });
    setQuery(''); setQty('1'); setSelectedKey(null); setShowSugg(false);
  };

  const remove = (k: string) => {
    const next = { ...ingredients };
    delete next[k];
    onChange(next);
  };

  const recipeMap = new Map(recipes.map((r) => [r.id, r.name]));
  const getLabel = (k: string) => recipeMap.get(k) ?? k;

  return (
    <div className="space-y-2">
      {/* Current list */}
      <div className="max-h-44 overflow-y-auto space-y-1 border border-gray-200 rounded-md p-2 bg-gray-50">
        {Object.keys(ingredients).length === 0 && (
          <p className="text-xs text-gray-400 italic">ยังไม่มี ingredient</p>
        )}
        {Object.entries(ingredients).map(([k, v]) => {
          const isRecipe = recipeIds.has(k);
          return (
            <div key={k} className="flex items-center gap-2 text-xs">
              <span className="flex-1 truncate">
                <span className={`rounded px-1.5 py-0.5 ${isRecipe ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                  {isRecipe ? '📦' : '🔹'} {getLabel(k)}
                </span>
              </span>
              <span className="font-semibold text-gray-700 w-8 text-right flex-shrink-0">×{v}</span>
              <button onClick={() => remove(k)} className="text-red-400 hover:text-red-600 font-bold flex-shrink-0">✕</button>
            </div>
          );
        })}
      </div>

      {/* Autocomplete input */}
      <div className="flex gap-2 items-center relative">
        <div className="flex-1 relative">
          <input
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onFocus={() => setShowSugg(true)}
            onBlur={() => setTimeout(() => setShowSugg(false), 150)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { setShowSugg(false); }
              if (e.key === 'Escape') { setShowSugg(false); }
            }}
            placeholder="พิมพ์หรือเลือกวัตถุดิบ / สินค้า…"
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:border-blue-400"
          />
          {showSugg && suggestions.length > 0 && (
            <ul className="absolute z-50 top-full left-0 right-0 mt-0.5 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto text-xs">
              {suggestions.map((o) => (
                <li
                  key={o.key}
                  onMouseDown={() => handleSelect(o)}
                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-indigo-50 cursor-pointer"
                >
                  <span className={`rounded px-1.5 py-0.5 text-xs flex-shrink-0 ${
                    o.type === 'recipe' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'
                  }`}>
                    {o.type === 'recipe' ? '📦' : '🔹'}
                  </span>
                  <span className="flex-1 truncate">{o.label}</span>
                </li>
              ))}
              {/* allow manual entry if no match */}
              {query.trim() && !allOptions.some((o) => o.label === query.trim()) && (
                <li
                  onMouseDown={() => { setSelectedKey(null); setShowSugg(false); }}
                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-yellow-50 cursor-pointer text-yellow-700 border-t border-gray-100"
                >
                  ✏️ ใช้ "<strong>{query.trim()}</strong>" (พิมพ์เอง)
                </li>
              )}
            </ul>
          )}
        </div>

        <input
          type="number" min={1} value={qty}
          onChange={(e) => setQty(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="จำนวน"
          className="w-16 rounded border border-gray-300 px-2 py-1.5 text-xs text-center focus:outline-none focus:border-blue-400"
        />
        <button
          onClick={add}
          disabled={!effectiveKey || Number(qty) <= 0}
          className="rounded bg-blue-500 text-white px-3 py-1.5 text-xs hover:bg-blue-600 disabled:opacity-40"
        >
          เพิ่ม
        </button>
      </div>
      <p className="text-xs text-gray-400">📦 สินค้า (Recipe)  🔹 วัตถุดิบดิบ (Stock)</p>
    </div>
  );
}

// ── Recipe form modal ─────────────────────────────────────────────────────────
interface RecipeFormProps {
  initial?: Recipe;
  recipes: Recipe[];
  machines: Machine[];
  stocks: StockMap;
  onSave: (data: Omit<Recipe, 'id'>) => Promise<void>;
  onCancel: () => void;
}

function RecipeForm({ initial, recipes, machines, stocks, onSave, onCancel }: RecipeFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [machineId, setMachineId] = useState(initial?.machine_id ?? '');
  const [timePerUnit, setTimePerUnit] = useState<string | null>(initial?.time_per_unit ?? null);
  const [ingredients, setIngredients] = useState<Record<string, number>>(initial?.ingredients ?? {});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const handleSave = async () => {
    if (!name.trim()) { setErr('กรุณากรอกชื่อ'); return; }
    if (!machineId.trim()) { setErr('กรุณาเลือกเครื่องจักร'); return; }
    setSaving(true); setErr('');
    try {
      await onSave({
        name: name.trim(),
        machine_id: machineId,
        time_per_unit: timePerUnit || null,
        ingredients,
      });
    } catch (e: unknown) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold text-gray-800">
          {initial ? '✏️ แก้ไข Recipe' : '➕ เพิ่ม Recipe ใหม่'}
        </h3>

        {/* Name */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">ชื่อสินค้า *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            placeholder="เช่น ช็อคโกแลตนม"
          />
        </div>

        {/* Machine */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">เครื่องจักร *</label>
          <select
            value={machineId}
            onChange={(e) => setMachineId(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="">— เลือกเครื่อง —</option>
            {machines
              .slice()
              .sort((a, b) => a.floor_number - b.floor_number)
              .map((m) => (
                <option key={m.machine_id} value={m.machine_id}>
                  ชั้น {m.floor_number} — {m.machine_name}
                </option>
              ))}
          </select>
        </div>

        {/* Time per unit */}
        <div>
          <TimeInput
            label="เวลาผลิตต่อชิ้น"
            value={timePerUnit}
            onChange={setTimePerUnit}
            allowNull
          />
        </div>

        {/* Ingredients */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">วัตถุดิบ (Ingredients)</label>
          <IngredientEditor
            ingredients={ingredients}
            recipes={recipes.filter((r) => r.id !== initial?.id)}
            stocks={stocks}
            onChange={setIngredients}
          />
        </div>

        {err && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{err}</p>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={onCancel}
            className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            ยกเลิก
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'กำลังบันทึก…' : '💾 บันทึก'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main RecipeEditor ─────────────────────────────────────────────────────────
export function RecipeEditor({ recipes, machines, stocks, onChange }: RecipeEditorProps) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Recipe | null>(null);
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  const machineMap = new Map(machines.map((m) => [m.machine_id, `ชั้น ${m.floor_number} — ${m.machine_name}`]));
  const recipeMap = new Map(recipes.map((r) => [r.id, r.name]));

  const filtered = recipes.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async (data: Omit<Recipe, 'id'>) => {
    await createRecipe(data);
    setShowForm(false);
    onChange();
  };

  const handleUpdate = async (data: Omit<Recipe, 'id'>) => {
    if (!editing) return;
    await updateRecipe(editing.id, data);
    setEditing(null);
    onChange();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('ต้องการลบ recipe นี้ใช่ไหม?')) return;
    setDeleting(id);
    try { await deleteRecipe(id); onChange(); }
    finally { setDeleting(null); }
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 ค้นหา recipe…"
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        <button
          onClick={() => setShowForm(true)}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          + เพิ่ม Recipe
        </button>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-gray-200 overflow-hidden max-h-[60vh] overflow-y-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">ชื่อสินค้า</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">เครื่องจักร</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">เวลา</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Ingredients</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400 italic">ไม่พบ recipe</td>
              </tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-2 font-medium text-gray-800">{r.name}</td>
                <td className="px-4 py-2 text-gray-600 text-xs">{machineMap.get(r.machine_id) ?? '—'}</td>
                <td className="px-4 py-2 text-center text-gray-600 font-mono text-xs">{r.time_per_unit ?? '—'}</td>
                <td className="px-4 py-2 text-xs">
                  <div className="flex flex-wrap gap-1 justify-center">
                    {Object.entries(r.ingredients).slice(0, 3).map(([k, v]) => (
                      <span key={k} className="bg-gray-100 rounded px-1.5 py-0.5 text-xs">
                        {recipeMap.get(k) ?? k} ×{v}
                      </span>
                    ))}
                    {Object.keys(r.ingredients).length > 3 && (
                      <span className="text-gray-400 text-xs">+{Object.keys(r.ingredients).length - 3}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-2 text-center">
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={() => setEditing(r)}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      แก้ไข
                    </button>
                    <button
                      onClick={() => handleDelete(r.id)}
                      disabled={deleting === r.id}
                      className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-50"
                    >
                      {deleting === r.id ? '…' : 'ลบ'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {showForm && (
        <RecipeForm
          recipes={recipes}
          machines={machines}
          stocks={stocks}
          onSave={handleCreate}
          onCancel={() => setShowForm(false)}
        />
      )}
      {editing && (
        <RecipeForm
          initial={editing}
          recipes={recipes}
          machines={machines}
          stocks={stocks}
          onSave={handleUpdate}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  );
}

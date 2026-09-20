import { useState } from 'react';
import { Recipe, Machine, StockMap } from '../../types';
import { createRecipe, updateRecipe, deleteRecipe } from '../../api/client';
import { TimeInput } from '../shared/TimeInput';
import { ImagePicker } from '../shared/ImagePicker';

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

      <div className="flex gap-2 items-center relative">
        <div className="flex-1 relative">
          <input
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onFocus={() => setShowSugg(true)}
            onBlur={() => setTimeout(() => setShowSugg(false), 150)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setShowSugg(false);
              if (e.key === 'Escape') setShowSugg(false);
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
  const [filterOcc, setFilterOcc] = useState<string>(() => {
    if (!initial?.machine_id) return '';
    const m = machines.find((m) => m.machine_id === initial.machine_id);
    return m?.occupation ?? '';
  });
  const [showMachineDropdown, setShowMachineDropdown] = useState(false);
  const [timePerUnit, setTimePerUnit] = useState<string | null>(initial?.time_per_unit ?? null);
  const [ingredients, setIngredients] = useState<Record<string, number>>(initial?.ingredients ?? {});
  const [image, setImage] = useState<string | undefined>(initial?.image);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const handleSave = async () => {
    if (!name.trim()) { setErr('กรุณากรอกชื่อ'); return; }
    const normalizedName = name.trim().normalize('NFKC').toLocaleLowerCase('th');
    const recipeIds = new Set(recipes.map((recipe) => recipe.id));
    const conflict = [
      ...recipes.filter((recipe) => recipe.id !== initial?.id).map((recipe) => recipe.name),
      ...machines.map((machine) => machine.machine_name),
      ...Object.keys(stocks).filter((key) => !recipeIds.has(key)),
    ].find((otherName) => otherName.trim().normalize('NFKC').toLocaleLowerCase('th') === normalizedName);
    if (conflict) { setErr(`ชื่อนี้ซ้ำกับ "${conflict}" กรุณาใช้ชื่ออื่น`); return; }
    setSaving(true); setErr('');
    try {
      await onSave({
        name: name.trim(),
        machine_id: machineId || null,
        time_per_unit: timePerUnit || null,
        ingredients,
        image: image || undefined,
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

        {/* Image */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">รูปสินค้า</label>
          <ImagePicker value={image} onChange={setImage} folder="recipes" itemId={initial?.id} />
        </div>

        {/* Machine — กรองด้วยอาชีพ */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">เครื่องจักร *</label>
          {(() => {
            const occupations = Array.from(
              new Set(machines.map((m) => m.occupation).filter(Boolean) as string[])
            ).sort((a, b) => a.localeCompare(b, 'th'));
            return occupations.length > 0 ? (
              <div className="flex gap-2 mb-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => { setFilterOcc(''); setMachineId(''); }}
                  className={`rounded-full px-3 py-0.5 text-xs border transition-colors ${
                    filterOcc === ''
                      ? 'bg-gray-700 text-white border-gray-700'
                      : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-400'
                  }`}
                >
                  ทั้งหมด
                </button>
                {occupations.map((occ) => (
                  <button
                    key={occ}
                    type="button"
                    onClick={() => { setFilterOcc(occ); setMachineId(''); }}
                    className={`rounded-full px-3 py-0.5 text-xs border transition-colors ${
                      filterOcc === occ
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    {occ}
                  </button>
                ))}
              </div>
            ) : null;
          })()}
          {/* Custom machine picker with image */}
          {(() => {
            const filteredMachines = machines
              .filter((m) => filterOcc === '' || m.occupation === filterOcc)
              .sort((a, b) => a.floor_number - b.floor_number);
            const selectedMachine = machines.find((m) => m.machine_id === machineId);
            return (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowMachineDropdown((v) => !v)}
                  onBlur={() => setTimeout(() => setShowMachineDropdown(false), 150)}
                  className="w-full flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm bg-white focus:border-blue-500 focus:outline-none text-left"
                >
                  {selectedMachine ? (
                    <>
                      {selectedMachine.image && (
                        <img src={selectedMachine.image} alt="" className="h-8 w-8 rounded object-contain bg-gray-50 border border-gray-100 flex-shrink-0" />
                      )}
                      <span className="flex-1 truncate">ชั้น {selectedMachine.floor_number} — {selectedMachine.machine_name}</span>
                    </>
                  ) : (
                    <span className="text-gray-400 flex-1">— เลือกเครื่อง —</span>
                  )}
                  <span className="text-gray-400 flex-shrink-0">▾</span>
                </button>
                {showMachineDropdown && (
                  <ul className="absolute z-50 top-full left-0 right-0 mt-0.5 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    <li
                      onMouseDown={() => { setMachineId(''); setShowMachineDropdown(false); }}
                      className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer text-gray-400 text-sm border-b border-gray-100"
                    >
                      — เลือกเครื่อง —
                    </li>
                    {filteredMachines.map((m) => (
                      <li
                        key={m.machine_id}
                        onMouseDown={() => { setMachineId(m.machine_id); setShowMachineDropdown(false); }}
                        className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-indigo-50 ${machineId === m.machine_id ? 'bg-indigo-50' : ''}`}
                      >
                        {m.image ? (
                          <img src={m.image} alt="" className="h-10 w-10 rounded object-contain bg-white border border-gray-100 flex-shrink-0" />
                        ) : (
                          <div className="h-10 w-10 rounded bg-gray-100 flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{m.machine_name}</p>
                          <p className="text-xs text-gray-400">ชั้น {m.floor_number}{m.occupation ? ` · ${m.occupation}` : ''}</p>
                        </div>
                        {machineId === m.machine_id && <span className="ml-auto text-indigo-500 flex-shrink-0">✓</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })()}
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
  const [filterMachine, setFilterMachine] = useState('');
  const [filterOcc, setFilterOcc] = useState<string>('');
  const [deleting, setDeleting] = useState<string | null>(null);

  const machineMap = new Map(machines.map((m) => [m.machine_id, `ชั้น ${m.floor_number} — ${m.machine_name}`]));
  const recipeMap = new Map(recipes.map((r) => [r.id, r.name]));

  const usedMachineIds = new Set(recipes.map((r) => r.machine_id));
  const occupationOptions = Array.from(
    new Set(
      machines
        .filter((m) => usedMachineIds.has(m.machine_id) && m.occupation)
        .map((m) => m.occupation!)
    )
  ).sort((a, b) => a.localeCompare(b, 'th'));

  const machineOptions = machines
    .filter((m) => usedMachineIds.has(m.machine_id))
    .sort((a, b) => a.machine_name.localeCompare(b.machine_name, 'th'));

  const filtered = recipes
    .filter((r) => {
      const matchSearch = r.name.toLowerCase().includes(search.toLowerCase());
      const matchMachine = filterMachine === '' || r.machine_id === filterMachine;
      const machine = machines.find((m) => m.machine_id === r.machine_id);
      const matchOcc = filterOcc === '' || machine?.occupation === filterOcc;
      return matchSearch && matchMachine && matchOcc;
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'th'));

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
      <div className="flex gap-2 flex-wrap">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ค้นหาชื่อ recipe…"
          className="flex-1 min-w-[140px] rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        <select
          value={filterMachine}
          onChange={(e) => setFilterMachine(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm bg-white focus:border-blue-500 focus:outline-none"
        >
          <option value="">ทุกเครื่องจักร</option>
          {machineOptions.map((m) => (
            <option key={m.machine_id} value={m.machine_id}>{m.machine_name}</option>
          ))}
        </select>
        {occupationOptions.length > 0 && (
          <select
            value={filterOcc}
            onChange={(e) => setFilterOcc(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm bg-white focus:border-blue-500 focus:outline-none"
          >
            <option value="">ทุกอาชีพ</option>
            {occupationOptions.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        )}
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
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 w-12">รูป</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">ชื่อสินค้า</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">เครื่องจักร</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">เวลา</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Ingredients</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400 italic">ไม่พบ recipe</td>
              </tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                {/* image thumbnail */}
                <td className="px-3 py-2">
                  {r.image ? (
                    <img
                      src={r.image}
                      alt={r.name}
                      className="h-10 w-10 rounded object-contain bg-gray-50 border border-gray-100"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded bg-gray-100 border border-gray-100 flex items-center justify-center text-gray-300 text-xs">
                      —
                    </div>
                  )}
                </td>
                <td className="px-4 py-2 font-medium text-gray-800">{r.name}</td>
                <td className="px-4 py-2 text-gray-600 text-xs">{r.machine_id ? (machineMap.get(r.machine_id) ?? '—') : '—'}</td>
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

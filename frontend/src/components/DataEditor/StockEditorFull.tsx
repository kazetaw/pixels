import { useState, useMemo } from 'react';
import { Upload, Button } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import { StockMap, StockImageMap, Recipe } from '../../types';
import { saveStocks } from '../../api/client';

interface StockEditorFullProps {
  stocks: StockMap;
  stockImages: StockImageMap;
  recipes: Recipe[];
  onSaved: (newStocks: StockMap, newImages: StockImageMap) => void;
}

// ── ImagePicker (inline, reused from RecipeEditor style) ──────────────────────
interface ImagePickerProps {
  value: string | undefined;
  onChange: (v: string | undefined) => void;
}

function ImagePicker({ value, onChange }: ImagePickerProps) {
  const uploadProps: UploadProps = {
    accept: 'image/*',
    showUploadList: false,
    beforeUpload: (file) => {
      const reader = new FileReader();
      reader.onload = () => onChange(reader.result as string);
      reader.readAsDataURL(file);
      return false;
    },
  };

  return (
    <div className="flex items-center gap-2">
      {value && (
        <img
          src={value}
          alt="preview"
          className="h-10 w-10 rounded object-contain bg-gray-50 border border-gray-200 flex-shrink-0"
        />
      )}
      <Upload {...uploadProps}>
        <Button icon={<UploadOutlined />} size="small">
          {value ? 'เปลี่ยน' : 'อัปโหลด'}
        </Button>
      </Upload>
    </div>
  );
}

// ── derive all known item names ───────────────────────────────────────────────
function buildItemNames(recipes: Recipe[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const r of recipes) {
    m.set(r.id, r.name);
    for (const k of Object.keys(r.ingredients)) {
      if (!m.has(k)) m.set(k, k);
    }
  }
  return m;
}

// ── main component ────────────────────────────────────────────────────────────
export function StockEditorFull({ stocks, stockImages, recipes, onSaved }: StockEditorFullProps) {
  const [local, setLocal] = useState<StockMap>({ ...stocks });
  const [localImages, setLocalImages] = useState<StockImageMap>({ ...stockImages });
  const [search, setSearch] = useState('');
  const [newKey, setNewKey] = useState('');
  const [newQty, setNewQty] = useState('');
  const [newImage, setNewImage] = useState<string | undefined>(undefined);
  const [useRecipe, setUseRecipe] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState('');

  const nameMap = useMemo(() => buildItemNames(recipes), [recipes]);

  const allKeys = useMemo(() => {
    const s = new Set<string>([...Object.keys(local), ...nameMap.keys()]);
    return Array.from(s).sort((a, b) => {
      const na = nameMap.get(a) ?? a;
      const nb = nameMap.get(b) ?? b;
      return na.localeCompare(nb, 'th');
    });
  }, [local, nameMap]);

  const filtered = allKeys.filter((k) => {
    const name = nameMap.get(k) ?? k;
    return name.toLowerCase().includes(search.toLowerCase()) || k.toLowerCase().includes(search.toLowerCase());
  });

  const handleChange = (key: string, val: string) => {
    setLocal((prev) => ({ ...prev, [key]: Number(val) }));
    setSaved(false);
  };

  const handleImageChange = (key: string, img: string | undefined) => {
    setLocalImages((prev) => {
      const next = { ...prev };
      if (img) next[key] = img;
      else delete next[key];
      return next;
    });
    setSaved(false);
  };

  const handleDelete = (key: string) => {
    setLocal((prev) => { const n = { ...prev }; delete n[key]; return n; });
    setLocalImages((prev) => { const n = { ...prev }; delete n[key]; return n; });
    setSaved(false);
  };

  const handleAdd = () => {
    const k = newKey.trim();
    const q = Number(newQty);
    if (!k) { setErr('กรุณากรอกชื่อหรือเลือก recipe'); return; }
    setLocal((prev) => ({ ...prev, [k]: q }));
    if (newImage) setLocalImages((prev) => ({ ...prev, [k]: newImage }));
    setNewKey(''); setNewQty(''); setNewImage(undefined); setErr(''); setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true); setErr(''); setSaved(false);
    try {
      await saveStocks(local, localImages);
      setSaved(true);
      onSaved(local, localImages);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: unknown) {
      setErr((e as Error).message ?? 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const recipeOptions = recipes
    .filter((r) => !Object.prototype.hasOwnProperty.call(local, r.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'th'));

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex gap-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="ค้นหารายการ…"
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
        <span className="text-xs text-gray-400 self-center whitespace-nowrap">{filtered.length} รายการ (เรียง ก-ฮ)</span>
      </div>

      {/* Stock table */}
      <div className="rounded-lg border border-gray-200 overflow-hidden max-h-[55vh] overflow-y-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase w-14">รูป</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">ชื่อรายการ</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase text-center w-32">จำนวนในสต็อก</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase w-16">ลบ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {filtered.map((key) => {
              const name = nameMap.get(key) ?? key;
              const isRecipe = recipes.some((r) => r.id === key);
              const img = localImages[key];
              return (
                <tr key={key} className="hover:bg-gray-50">
                  {/* image cell */}
                  <td className="px-3 py-2">
                    <ImagePicker
                      value={img}
                      onChange={(v) => handleImageChange(key, v)}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <p className="font-medium text-gray-800 text-sm">{name}</p>
                    {isRecipe && <p className="text-xs text-blue-500">สินค้ากึ่งสำเร็จรูป</p>}
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number" min={0}
                      value={local[key] ?? 0}
                      onChange={(e) => handleChange(key, e.target.value)}
                      className="w-full rounded border border-gray-300 px-2 py-1 text-sm text-right focus:border-blue-500 focus:outline-none"
                    />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button onClick={() => handleDelete(key)}
                      className="text-red-400 hover:text-red-600 text-base font-bold leading-none">✕</button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400 italic">ไม่พบรายการ</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add row */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">➕ เพิ่มรายการใหม่</p>
        <div className="flex gap-2 items-center flex-wrap">
          <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
            <input type="checkbox" checked={useRecipe} onChange={(e) => { setUseRecipe(e.target.checked); setNewKey(''); }}
              className="w-3 h-3" />
            เลือกจาก Recipe
          </label>
          {useRecipe ? (
            <select value={newKey} onChange={(e) => setNewKey(e.target.value)}
              className="flex-1 min-w-[160px] rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none">
              <option value="">— เลือก recipe —</option>
              {recipeOptions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          ) : (
            <input value={newKey} onChange={(e) => setNewKey(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="ชื่อวัตถุดิบดิบ"
              className="flex-1 min-w-[160px] rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none" />
          )}
          <input type="number" min={0} value={newQty} onChange={(e) => setNewQty(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="จำนวน"
            className="w-24 rounded border border-gray-300 px-2 py-1.5 text-sm text-center focus:border-blue-500 focus:outline-none" />
          <button onClick={handleAdd}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
            เพิ่ม
          </button>
        </div>
        {/* image for new item */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">รูปรายการใหม่:</span>
          <ImagePicker value={newImage} onChange={setNewImage} />
        </div>
        {err && <p className="text-xs text-red-600">{err}</p>}
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={saving}
          className="rounded-md bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 shadow-sm">
          {saving ? 'กำลังบันทึก…' : '💾 บันทึกสต็อก'}
        </button>
        {saved && <span className="text-sm text-green-600 font-medium">✓ บันทึกสำเร็จ</span>}
      </div>
    </div>
  );
}

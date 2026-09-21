import { useState } from 'react';
import {
  Input, InputNumber, Select, Button, Tag, Space, Popconfirm, Modal, Form,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, SearchOutlined, EditOutlined,
} from '@ant-design/icons';
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
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [qty, setQty] = useState<number>(1);

  const recipeOptions = recipes.map((r) => ({
    label: r.name, value: r.id, type: 'recipe' as const,
  }));
  const recipeIds = new Set(recipes.map((r) => r.id));
  const rawOptions = Object.keys(stocks)
    .filter((k) => !recipeIds.has(k))
    .map((k) => ({ label: k, value: k, type: 'raw' as const }));

  const allOptions = [
    { label: '── สินค้า (Recipe) ──', options: recipeOptions },
    { label: '── วัตถุดิบดิบ ──', options: rawOptions },
  ];

  const add = () => {
    if (!selectedKey || qty <= 0) return;
    onChange({ ...ingredients, [selectedKey]: qty });
    setSelectedKey(null);
    setQty(1);
  };

  const remove = (k: string) => {
    const next = { ...ingredients };
    delete next[k];
    onChange(next);
  };

  const recipeMap = new Map(recipes.map((r) => [r.id, r.name]));
  const getLabel = (k: string) => recipeMap.get(k) ?? k;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Ingredient list */}
      <div style={{
        maxHeight: 160, overflowY: 'auto',
        border: '1px solid #e2e8f0', borderRadius: 6,
        padding: 8, background: '#f8fafc',
        display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        {Object.keys(ingredients).length === 0 && (
          <p style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic', margin: 0 }}>ยังไม่มี ingredient</p>
        )}
        {Object.entries(ingredients).map(([k, v]) => {
          const isRecipe = recipeIds.has(k);
          return (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Tag color={isRecipe ? 'blue' : 'green'} style={{ margin: 0, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {getLabel(k)}
              </Tag>
              <span style={{ fontSize: 12, color: '#374151', fontWeight: 600, marginLeft: 'auto', flexShrink: 0 }}>
                ×{v}
              </span>
              <Button
                type="text" size="small" danger
                icon={<DeleteOutlined />}
                onClick={() => remove(k)}
                style={{ flexShrink: 0 }}
              />
            </div>
          );
        })}
      </div>

      {/* Add row */}
      <Space.Compact style={{ width: '100%' }}>
        <Select
          value={selectedKey}
          onChange={setSelectedKey}
          placeholder="เลือกวัตถุดิบหรือสินค้า…"
          showSearch
          style={{ flex: 1 }}
          size="small"
          options={allOptions}
          filterOption={(input, opt) =>
            (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
          }
          allowClear
        />
        <InputNumber
          min={1}
          value={qty}
          onChange={(v) => setQty(v ?? 1)}
          style={{ width: 70 }}
          size="small"
        />
        <Button
          type="primary"
          size="small"
          icon={<PlusOutlined />}
          onClick={add}
          disabled={!selectedKey || qty <= 0}
        >
          เพิ่ม
        </Button>
      </Space.Compact>
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
  const [form] = Form.useForm();
  const [filterOcc, setFilterOcc] = useState<string>(() => {
    if (!initial?.machine_id) return '';
    return machines.find((m) => m.machine_id === initial.machine_id)?.occupation ?? '';
  });
  const [machineId, setMachineId] = useState(initial?.machine_id ?? '');
  const [showMachineDropdown, setShowMachineDropdown] = useState(false);
  const [timePerUnit, setTimePerUnit] = useState<string | null>(initial?.time_per_unit ?? null);
  const [ingredients, setIngredients] = useState<Record<string, number>>(initial?.ingredients ?? {});
  const [image, setImage] = useState<string | undefined>(initial?.image);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const normalizedName = values.name.trim().normalize('NFKC').toLocaleLowerCase('th');
      const recipeIds = new Set(recipes.map((r) => r.id));
      const conflict = [
        ...recipes.filter((r) => r.id !== initial?.id).map((r) => r.name),
        ...machines.map((m) => m.machine_name),
        ...Object.keys(stocks).filter((k) => !recipeIds.has(k)),
      ].find((n) => n.trim().normalize('NFKC').toLocaleLowerCase('th') === normalizedName);
      if (conflict) {
        form.setFields([{ name: 'name', errors: [`ชื่อนี้ซ้ำกับ "${conflict}"`] }]);
        return;
      }
      setSaving(true); setErr('');
      await onSave({
        name: values.name.trim(),
        machine_id: machineId || null,
        time_per_unit: timePerUnit || null,
        ingredients,
        image: image || undefined,
      });
    } catch (e: unknown) {
      if ((e as { errorFields?: unknown }).errorFields) return; // AntD validation
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const occupations = Array.from(
    new Set(machines.map((m) => m.occupation).filter(Boolean) as string[])
  ).sort((a, b) => a.localeCompare(b, 'th'));

  const filteredMachines = machines
    .filter((m) => filterOcc === '' || m.occupation === filterOcc)
    .sort((a, b) => a.floor_number - b.floor_number);

  const selectedMachine = machines.find((m) => m.machine_id === machineId);

  return (
    <Modal
      open
      title={initial ? 'แก้ไข Recipe' : 'เพิ่ม Recipe ใหม่'}
      onCancel={onCancel}
      onOk={handleSave}
      okText={saving ? 'กำลังบันทึก…' : 'บันทึก'}
      cancelText="ยกเลิก"
      confirmLoading={saving}
      width={560}
      destroyOnClose
    >
      <Form form={form} layout="vertical" style={{ marginTop: 8 }}
        initialValues={{ name: initial?.name ?? '' }}
      >
        {/* Name */}
        <Form.Item name="name" label="ชื่อสินค้า"
          rules={[{ required: true, message: 'กรุณากรอกชื่อ' }]}
        >
          <Input placeholder="เช่น ช็อคโกแลตนม" autoFocus />
        </Form.Item>

        {/* Image */}
        <Form.Item label="รูปสินค้า">
          <ImagePicker value={image} onChange={setImage} folder="recipes" itemId={initial?.id} size={56} variant="button" />
        </Form.Item>

        {/* Machine */}
        <Form.Item label="เครื่องจักร">
          {/* Occupation filter chips */}
          {occupations.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {['', ...occupations].map((occ) => (
                <button
                  key={occ || '__all__'}
                  type="button"
                  onClick={() => { setFilterOcc(occ); setMachineId(''); }}
                  style={{
                    borderRadius: 99, padding: '2px 10px', fontSize: 12, cursor: 'pointer',
                    border: '1px solid',
                    background: filterOcc === occ ? '#2563eb' : '#f8fafc',
                    color: filterOcc === occ ? '#fff' : '#64748b',
                    borderColor: filterOcc === occ ? '#2563eb' : '#e2e8f0',
                  }}
                >
                  {occ || 'ทั้งหมด'}
                </button>
              ))}
            </div>
          )}
          {/* Machine dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setShowMachineDropdown((v) => !v)}
              onBlur={() => setTimeout(() => setShowMachineDropdown(false), 150)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                borderRadius: 6, border: '1px solid #e2e8f0', padding: '6px 10px',
                background: '#fff', cursor: 'pointer', fontSize: 13, textAlign: 'left',
              }}
            >
              {selectedMachine ? (
                <>
                  {selectedMachine.image && (
                    <img src={selectedMachine.image} alt="" style={{ width: 28, height: 28, borderRadius: 4, objectFit: 'contain', flexShrink: 0 }} />
                  )}
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    ชั้น {selectedMachine.floor_number} — {selectedMachine.machine_name}
                  </span>
                </>
              ) : (
                <span style={{ color: '#94a3b8', flex: 1 }}>— เลือกเครื่อง —</span>
              )}
              <span style={{ color: '#94a3b8' }}>▾</span>
            </button>
            {showMachineDropdown && (
              <ul style={{
                position: 'absolute', zIndex: 1000, top: '100%', left: 0, right: 0,
                background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6,
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)', maxHeight: 240, overflowY: 'auto',
                listStyle: 'none', margin: '2px 0 0', padding: 0,
              }}>
                <li
                  onMouseDown={() => { setMachineId(''); setShowMachineDropdown(false); }}
                  style={{ padding: '8px 12px', cursor: 'pointer', color: '#94a3b8', fontSize: 13, borderBottom: '1px solid #f1f5f9' }}
                >
                  — เลือกเครื่อง —
                </li>
                {filteredMachines.map((m) => (
                  <li
                    key={m.machine_id}
                    onMouseDown={() => { setMachineId(m.machine_id); setShowMachineDropdown(false); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '6px 12px', cursor: 'pointer', fontSize: 13,
                      background: machineId === m.machine_id ? '#eff6ff' : undefined,
                    }}
                  >
                    {m.image
                      ? <img src={m.image} alt="" style={{ width: 36, height: 36, borderRadius: 4, objectFit: 'contain', flexShrink: 0 }} />
                      : <div style={{ width: 36, height: 36, borderRadius: 4, background: '#f1f5f9', flexShrink: 0 }} />
                    }
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.machine_name}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>ชั้น {m.floor_number}{m.occupation ? ` · ${m.occupation}` : ''}</div>
                    </div>
                    {machineId === m.machine_id && <span style={{ marginLeft: 'auto', color: '#2563eb', flexShrink: 0 }}>✓</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Form.Item>

        {/* Time per unit */}
        <Form.Item label="เวลาผลิตต่อชิ้น">
          <TimeInput value={timePerUnit} onChange={setTimePerUnit} allowNull />
        </Form.Item>

        {/* Ingredients */}
        <Form.Item label="วัตถุดิบ (Ingredients)">
          <IngredientEditor
            ingredients={ingredients}
            recipes={recipes.filter((r) => r.id !== initial?.id)}
            stocks={stocks}
            onChange={setIngredients}
          />
        </Form.Item>

        {err && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '8px 12px', fontSize: 13, color: '#dc2626' }}>
            {err}
          </div>
        )}
      </Form>
    </Modal>
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
      <Space wrap>
        <Input
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ค้นหาชื่อ recipe…"
          style={{ width: 200 }}
          allowClear
        />
        <Select
          value={filterMachine || undefined}
          onChange={(v) => setFilterMachine(v ?? '')}
          placeholder="ทุกเครื่องจักร"
          allowClear
          style={{ width: 160 }}
          options={[
            ...machineOptions.map((m) => ({ label: m.machine_name, value: m.machine_id })),
          ]}
        />
        {occupationOptions.length > 0 && (
          <Select
            value={filterOcc || undefined}
            onChange={(v) => setFilterOcc(v ?? '')}
            placeholder="ทุกอาชีพ"
            allowClear
            style={{ width: 130 }}
            options={occupationOptions.map((o) => ({ label: o, value: o }))}
          />
        )}
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setShowForm(true)}
        >
          เพิ่ม Recipe
        </Button>
      </Space>

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
                  <Space>
                    <Button
                      type="link" size="small"
                      icon={<EditOutlined />}
                      onClick={() => setEditing(r)}
                    />
                    <Popconfirm
                      title="ลบ recipe นี้?"
                      okText="ลบ" cancelText="ยกเลิก" okType="danger"
                      onConfirm={() => handleDelete(r.id)}
                    >
                      <Button
                        type="link" size="small" danger
                        icon={<DeleteOutlined />}
                        loading={deleting === r.id}
                      />
                    </Popconfirm>
                  </Space>
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

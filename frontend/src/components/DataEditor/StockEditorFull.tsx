import { itemSelectVisuals } from '../shared/ItemVisual';
import { useState, useMemo } from 'react';
import {
  Table, Button, Input, InputNumber, Select, Modal, Form,
  Popconfirm, Tag, Space, message, Typography,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, SearchOutlined, SaveOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { StockMap, StockImageMap, Recipe, Machine } from '../../types';
import { createCatalogItem, saveStocks, updateRecipe } from '../../api/client';
import { ImagePicker } from '../shared/ImagePicker';

const { Text } = Typography;

interface StockEditorFullProps {
  stocks: StockMap;
  stockImages: StockImageMap;
  recipes: Recipe[];
  machines: Machine[];
  itemNames: Record<string, string>;
  onSaved: (newStocks: StockMap, newImages: StockImageMap) => void;
  onRecipeImageChanged: (recipe: Recipe) => void;
}

const normalizedItemKey = (value: string) => value.trim().normalize('NFKC').toLocaleLowerCase('th');
const recipeForStockItem = (recipes: Recipe[], key: string) => recipes.find((recipe) =>
  recipe.id === key || normalizedItemKey(recipe.name) === normalizedItemKey(key));

function buildItemNames(recipes: Recipe[], itemNames: Record<string, string>): Map<string, string> {
  const m = new Map<string, string>(Object.entries(itemNames));
  for (const r of recipes) {
    m.set(r.id, r.name);
    for (const k of Object.keys(r.ingredients)) {
      if (!m.has(k)) m.set(k, k);
    }
  }
  return m;
}

// ── Add Item Modal ────────────────────────────────────────────────────────────
interface AddModalProps {
  open: boolean;
  recipes: Recipe[];
  machines: Machine[];
  existingKeys: string[];
  onAdd: (key: string, qty: number, image?: string) => void | Promise<void>;
  onClose: () => void;
}

function AddItemModal({ open, recipes, machines, existingKeys, onAdd, onClose }: AddModalProps) {
  const [form] = Form.useForm();
  const [mode, setMode] = useState<'raw' | 'recipe'>('raw');
  const [image, setImage] = useState<string | undefined>();
  const [adding, setAdding] = useState(false);

  const recipeOptions = recipes
    .filter((r) => !existingKeys.includes(r.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'th'))
    .map((r) => ({ label: r.name, value: r.id }));

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setAdding(true);

      let key = '';
      if (mode === 'recipe') {
        key = values.recipe_id;
      } else {
        const rawName = values.raw_name.trim();
        // duplicate check
        const norm = rawName.normalize('NFKC').toLocaleLowerCase('th');
        const recipeIds = new Set(recipes.map((r) => r.id));
        const conflict = [
          ...recipes.map((r) => r.name),
          ...machines.map((m) => m.machine_name),
          ...existingKeys.filter((k) => !recipeIds.has(k)),
        ].find((n) => n.trim().normalize('NFKC').toLocaleLowerCase('th') === norm);
        if (conflict) {
          form.setFields([{ name: 'raw_name', errors: [`ชื่อนี้ซ้ำกับ "${conflict}"`] }]);
          setAdding(false);
          return;
        }
        const item = await createCatalogItem(rawName, image);
        key = item.item_id;
      }

      await onAdd(key, values.qty ?? 0, image);
      form.resetFields();
      setImage(undefined);
      setMode('raw');
      onClose();
    } catch {
      // validation
    } finally {
      setAdding(false);
    }
  };

  const handleClose = () => {
    form.resetFields();
    setImage(undefined);
    setMode('raw');
    onClose();
  };

  return (
    <Modal
      open={open}
      title="เพิ่มรายการสต็อก"
      okText="เพิ่ม"
      cancelText="ยกเลิก"
      onOk={handleOk}
      onCancel={handleClose}
      confirmLoading={adding}
      destroyOnClose
    >
      <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
        {/* Mode selector */}
        <Form.Item label="ประเภทรายการ">
          <Select
            value={mode}
            onChange={(v) => { setMode(v); form.resetFields(['raw_name', 'recipe_id']); }}
            options={[
              { label: 'วัตถุดิบดิบ (พิมพ์ชื่อเอง)', value: 'raw' },
              { label: 'สินค้าจาก Recipe', value: 'recipe' },
            ]}
          />
        </Form.Item>

        {/* Raw material name */}
        {mode === 'raw' && (
          <Form.Item
            name="raw_name"
            label="ชื่อวัตถุดิบ"
            rules={[{ required: true, message: 'กรุณากรอกชื่อ' }]}
          >
            <Input placeholder="เช่น แร่เหล็ก, ใบไม้สีเขียว" autoFocus />
          </Form.Item>
        )}

        {/* Recipe picker */}
        {mode === 'recipe' && (
          <Form.Item
            name="recipe_id"
            label="Recipe"
            rules={[{ required: true, message: 'กรุณาเลือก recipe' }]}
          >
            <Select
              showSearch
              placeholder="ค้นหา recipe…"
              {...itemSelectVisuals} options={recipeOptions}
              filterOption={(input, opt) =>
                (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>
        )}

        {/* Quantity */}
        <Form.Item name="qty" label="จำนวนเริ่มต้น" initialValue={0}>
          <InputNumber min={0} style={{ width: '100%' }} />
        </Form.Item>

        {/* Image */}
        <Form.Item label="รูปภาพ (ไม่บังคับ)">
          <ImagePicker
            value={image}
            onChange={setImage}
            folder="stocks"
            size={48}
            variant="button"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
interface RowData {
  key: string;
  name: string;
  isRecipe: boolean;
  qty: number;
  image?: string;
}

export function StockEditorFull({ stocks, stockImages, recipes, machines, itemNames, onSaved, onRecipeImageChanged }: StockEditorFullProps) {
  const [local, setLocal] = useState<StockMap>({ ...stocks });
  const [localImages, setLocalImages] = useState<StockImageMap>({ ...stockImages });
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msgApi, msgCtx] = message.useMessage();

  const nameMap = useMemo(() => buildItemNames(recipes, itemNames), [recipes, itemNames]);

  const allKeys = useMemo(() => {
    // This screen is the physical stock list. Recipe ingredients belong in the
    // recipe editor and must not create phantom zero-quantity stock rows.
    return Object.keys(local).sort((a, b) => {
      const na = nameMap.get(a) ?? a;
      const nb = nameMap.get(b) ?? b;
      return na.localeCompare(nb, 'th');
    });
  }, [local, nameMap]);

  const tableData: RowData[] = allKeys
    .filter((k) => {
      const name = nameMap.get(k) ?? k;
      return (
        name.toLowerCase().includes(search.toLowerCase()) ||
        k.toLowerCase().includes(search.toLowerCase())
      );
    })
    .map((k) => ({
      key: k,
      name: nameMap.get(k) ?? k,
      isRecipe: recipes.some((r) => r.id === k),
      qty: local[k] ?? 0,
      image: recipeForStockItem(recipes, k)?.image ?? localImages[k],
    }));

  const handleQtyChange = (key: string, val: number | null) => {
    setLocal((prev) => ({ ...prev, [key]: val ?? 0 }));
  };

  const handleImageChange = async (key: string, img: string | undefined) => {
    const recipe = recipeForStockItem(recipes, key);
    if (recipe) {
      const updated = await updateRecipe(recipe.id, {
        name: recipe.name, machine_id: recipe.machine_id, time_per_unit: recipe.time_per_unit,
        ingredients: recipe.ingredients, image: img,
      });
      setLocalImages((prev) => {
        const next = { ...prev };
        if (img) next[key] = img;
        else delete next[key];
        return next;
      });
      onRecipeImageChanged(updated);
      return;
    }
    setLocalImages((prev) => {
      const next = { ...prev };
      if (img) next[key] = img;
      else delete next[key];
      return next;
    });
  };

  const handleDelete = (key: string) => {
    setLocal((prev) => { const n = { ...prev }; delete n[key]; return n; });
    setLocalImages((prev) => { const n = { ...prev }; delete n[key]; return n; });
  };

  const handleAdd = async (key: string, qty: number, image?: string) => {
    setLocal((prev) => ({ ...prev, [key]: qty }));
    const recipe = recipeForStockItem(recipes, key);
    if (image && recipe) {
      const updated = await updateRecipe(recipe.id, {
        name: recipe.name, machine_id: recipe.machine_id, time_per_unit: recipe.time_per_unit,
        ingredients: recipe.ingredients, image,
      });
      setLocalImages((prev) => ({ ...prev, [key]: image }));
      onRecipeImageChanged(updated);
    } else if (image) setLocalImages((prev) => ({ ...prev, [key]: image }));
    msgApi.success('เพิ่มรายการแล้ว');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveStocks(local, localImages);
      onSaved(local, localImages);
      msgApi.success('บันทึกสต็อกสำเร็จ');
    } catch (e: unknown) {
      msgApi.error((e as Error).message ?? 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnsType<RowData> = [
    {
      title: 'รูป',
      dataIndex: 'image',
      width: 64,
      align: 'center',
      render: (_, row) => (
        <ImagePicker
          value={row.image}
          fallbackImage={recipes.find((recipe) => recipe.id === row.key)?.image}
          onChange={(v) => handleImageChange(row.key, v)}
          folder="stocks"
          itemId={row.key}
          variant="table"
        />
      ),
    },
    {
      title: 'ชื่อรายการ',
      dataIndex: 'name',
      render: (name, row) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: 13 }}>{name}</Text>
          {row.isRecipe && (
            <Tag color="blue" style={{ fontSize: 11, marginTop: 2 }}>สินค้ากึ่งสำเร็จรูป</Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'จำนวนในสต็อก',
      dataIndex: 'qty',
      width: 140,
      align: 'right',
      render: (_, row) => (
        <InputNumber
          min={0}
          value={local[row.key] ?? 0}
          onChange={(v) => handleQtyChange(row.key, v)}
          style={{ width: 100 }}
          size="small"
        />
      ),
    },
    {
      title: '',
      width: 48,
      align: 'center',
      render: (_, row) => (
        <Popconfirm
          title="ลบรายการนี้?"
          description="ต้องการลบออกจากสต็อกใช่ไหม"
          okText="ลบ"
          cancelText="ยกเลิก"
          okType="danger"
          onConfirm={() => handleDelete(row.key)}
        >
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined />}
          />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {msgCtx}

      {/* Toolbar */}
      <Space wrap>
        <Input
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ค้นหารายการ…"
          style={{ width: 240 }}
          allowClear
        />
        <Text type="secondary" style={{ fontSize: 12 }}>
          {tableData.length} รายการ
        </Text>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setAddOpen(true)}
        >
          เพิ่มรายการ
        </Button>
        <Button
          icon={<SaveOutlined />}
          loading={saving}
          onClick={handleSave}
        >
          บันทึกสต็อก
        </Button>
      </Space>

      {/* Table */}
      <Table<RowData>
        columns={columns}
        dataSource={tableData}
        rowKey="key"
        pagination={{ pageSize: 20, showSizeChanger: false, showTotal: (t) => `ทั้งหมด ${t} รายการ` }}
        size="small"
        scroll={{ y: 480 }}
        locale={{ emptyText: 'ไม่พบรายการ' }}
      />

      {/* Add modal */}
      <AddItemModal
        open={addOpen}
        recipes={recipes}
        machines={machines}
        existingKeys={Object.keys(local)}
        onAdd={handleAdd}
        onClose={() => setAddOpen(false)}
      />
    </div>
  );
}

import { ItemThumbnail } from '../shared/ItemVisual';
/**
 * StockInventory.tsx
 *
 * Read-only stock view — shows all items currently in the warehouse.
 * Supports:
 *   - Search by name
 *   - Sort A→Z / ก→ฮ or by quantity (high → low)
 *   - Distinguishes recipe products vs raw materials
 */
import { useEffect, useMemo, useState } from 'react';
import { Button, Input, InputNumber, Popconfirm, Segmented, Table, Tag, Empty, Typography } from 'antd';
import { DeleteOutlined, SaveOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType, TableProps } from 'antd/es/table';
import type { Recipe, StockMap, StockImageMap } from '../../types';

const { Text } = Typography;

interface RowData {
  key: string;
  name: string;
  qty: number;
  isRecipe: boolean;
  image?: string;
}

interface StockInventoryProps {
  stocks: StockMap;
  stockImages: StockImageMap;
  recipes: Recipe[];
  onSaveStocks: (stocks: StockMap) => Promise<void>;
}

export function StockInventory({ stocks, stockImages, recipes, onSaveStocks }: StockInventoryProps) {
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<'available' | 'all' | 'empty'>('available');
  const [draftStocks, setDraftStocks] = useState<StockMap>(stocks);
  const [savingKey, setSavingKey] = useState<string>();
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => { setDraftStocks(stocks); }, [stocks]);

  const nameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of recipes) {
      m.set(r.id, r.name);
      for (const k of Object.keys(r.ingredients)) {
        if (!m.has(k)) m.set(k, k);
      }
    }
    return m;
  }, [recipes]);

  const recipeIds = useMemo(() => new Set(recipes.map((r) => r.id)), [recipes]);

  const rows: RowData[] = useMemo(() => {
    const allKeys = new Set<string>([...Object.keys(draftStocks), ...nameMap.keys()]);
    return Array.from(allKeys).map((key) => ({
      key,
      name: nameMap.get(key) ?? key,
      qty: draftStocks[key] ?? 0,
      isRecipe: recipeIds.has(key),
      image: stockImages[key],
    }));
  }, [draftStocks, nameMap, recipeIds, stockImages]);

  const persist = async (key: string, next: StockMap) => {
    setSavingKey(key); setSaveError(null);
    try { await onSaveStocks(next); }
    catch (error) { setSaveError((error as Error).message || 'บันทึกสต็อกไม่สำเร็จ'); }
    finally { setSavingKey(undefined); }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const matchingSearch = q
      ? rows.filter((r) => r.name.toLowerCase().includes(q) || r.key.toLowerCase().includes(q))
      : rows;
    const result = matchingSearch.filter((row) => {
      if (stockFilter === 'available') return row.qty > 0;
      if (stockFilter === 'empty') return row.qty === 0;
      return true;
    });
    // Default sort: A→Z / ก→ฮ
    return [...result].sort((a, b) => a.name.localeCompare(b.name, 'th'));
  }, [rows, search, stockFilter]);

  const totalItems = rows.length;
  const totalQty   = rows.reduce((s, r) => s + r.qty, 0);
  const inStock    = rows.filter((r) => r.qty > 0).length;
  const outOfStock = totalItems - inStock;

  const columns: ColumnsType<RowData> = [
    {
      title: '',
      dataIndex: 'image',
      width: 52,
      align: 'center',
      render: (_, row) => <ItemThumbnail id={row.key} image={row.image} size={36} />,
    },
    {
      title: 'ชื่อรายการ',
      dataIndex: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name, 'th'),
      defaultSortOrder: 'ascend',
      render: (name, row) => (
        <div>
          <Text strong style={{ fontSize: 13 }}>{name}</Text>
          {row.isRecipe && <Tag color="blue" style={{ marginLeft: 6, fontSize: 11 }}>สินค้า</Tag>}
        </div>
      ),
    },
    {
      title: 'จำนวนในคลัง',
      dataIndex: 'qty',
      align: 'right',
      width: 140,
      sorter: (a, b) => a.qty - b.qty,
      render: (qty, row) => <InputNumber min={0} value={qty} size="small" style={{ width: 100 }}
        onChange={(value) => setDraftStocks((current) => ({ ...current, [row.key]: value ?? 0 }))} />,
    },
    {
      title: 'สถานะ',
      dataIndex: 'qty',
      width: 90,
      align: 'center',
      render: (qty) => qty > 0 ? <Tag color="green">มีสต็อก</Tag> : <Tag color="default">หมด</Tag>,
    },
    {
      title: 'จัดการ', width: 130, align: 'center', render: (_, row) => <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
        <Button size="small" type="text" icon={<SaveOutlined />} loading={savingKey === row.key}
          disabled={savingKey !== undefined || draftStocks[row.key] === stocks[row.key]}
          onClick={() => void persist(row.key, draftStocks)} aria-label={`บันทึก ${row.name}`} />
        <Popconfirm title={`ลบ “${row.name}” ออกจากสต็อก?`} description="รายการจะหายจากคลัง แต่ข้อมูลสินค้ายังอยู่" okText="ลบ" cancelText="ยกเลิก"
          onConfirm={() => { const next = { ...draftStocks }; delete next[row.key]; void persist(row.key, next); }}>
          <Button size="small" type="text" danger icon={<DeleteOutlined />} disabled={savingKey !== undefined} aria-label={`ลบ ${row.name}`} />
        </Popconfirm>
      </div>,
    },
  ];

  const onChange: TableProps<RowData>['onChange'] = () => {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Summary bar */}
      <div style={{ display: 'flex', gap: 24, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 20px' }}>
        {[
          { label: 'รายการทั้งหมด', value: totalItems.toLocaleString() },
          { label: 'มีสต็อก',       value: inStock.toLocaleString() },
          { label: 'รวมทุกชิ้น',    value: totalQty.toLocaleString() },
        ].map(({ label, value }) => (
          <div key={label}>
            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: '#0f172a', lineHeight: 1.2 }}>{value}</div>
          </div>
        ))}
      </div>

      <div className="inventory-toolbar">
        <Input
          prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ค้นหาชื่อหรือรหัสรายการ"
          allowClear
          className="inventory-search"
        />
        <Segmented
          aria-label="กรองสถานะสต็อก"
          value={stockFilter}
          onChange={(value) => setStockFilter(value as typeof stockFilter)}
          options={[
            { label: `มีสต็อก (${inStock})`, value: 'available' },
            { label: `ทั้งหมด (${totalItems})`, value: 'all' },
            { label: `หมด (${outOfStock})`, value: 'empty' },
          ]}
        />
        <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
          แสดง {filtered.length} รายการ · คลิกหัวตารางเพื่อเรียงลำดับ
        </Text>
      </div>
      {saveError && <Text type="danger" style={{ fontSize: 12 }}>{saveError}</Text>}

      <Table<RowData>
        columns={columns}
        dataSource={filtered}
        rowKey="key"
        onChange={onChange}
        pagination={{ pageSize: 25, showSizeChanger: false, showTotal: (t) => `ทั้งหมด ${t} รายการ` }}
        size="small"
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="ไม่พบรายการ" /> }}
        rowClassName={(row) => row.qty === 0 ? 'opacity-50' : ''}
      />
    </div>
  );
}

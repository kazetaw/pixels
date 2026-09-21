/**
 * StockInventory.tsx
 *
 * Read-only stock view — shows all items currently in the warehouse.
 * Supports:
 *   - Search by name
 *   - Sort A→Z / ก→ฮ or by quantity (high → low)
 *   - Distinguishes recipe products vs raw materials
 */
import { useMemo, useState } from 'react';
import { Input, Select, Table, Tag, Empty, Typography } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { Recipe, StockMap, StockImageMap } from '../../types';

const { Text } = Typography;

type SortMode = 'az' | 'qty';

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
}

export function StockInventory({ stocks, stockImages, recipes }: StockInventoryProps) {
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('az');

  // Build name map from recipes
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
    const allKeys = new Set<string>([...Object.keys(stocks), ...nameMap.keys()]);

    return Array.from(allKeys).map((key) => ({
      key,
      name: nameMap.get(key) ?? key,
      qty: stocks[key] ?? 0,
      isRecipe: recipeIds.has(key),
      image: stockImages[key],
    }));
  }, [stocks, nameMap, recipeIds, stockImages]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const result = q
      ? rows.filter((r) => r.name.toLowerCase().includes(q) || r.key.toLowerCase().includes(q))
      : rows;

    if (sortMode === 'qty') {
      return [...result].sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name, 'th'));
    }
    // az — ก-ฮ then A-Z
    return [...result].sort((a, b) => a.name.localeCompare(b.name, 'th'));
  }, [rows, search, sortMode]);

  const totalItems = filtered.length;
  const totalQty   = filtered.reduce((s, r) => s + r.qty, 0);
  const inStock    = filtered.filter((r) => r.qty > 0).length;

  const columns: ColumnsType<RowData> = [
    {
      title: '',
      dataIndex: 'image',
      width: 52,
      align: 'center',
      render: (_, row) =>
        row.image ? (
          <img
            src={row.image}
            alt={row.name}
            style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'contain', background: '#f8fafc' }}
          />
        ) : (
          <div style={{ width: 36, height: 36, borderRadius: 6, background: '#f1f5f9', margin: '0 auto' }} />
        ),
    },
    {
      title: 'ชื่อรายการ',
      dataIndex: 'name',
      render: (name, row) => (
        <div>
          <Text strong style={{ fontSize: 13 }}>{name}</Text>
          {row.isRecipe && (
            <Tag color="blue" style={{ marginLeft: 6, fontSize: 11 }}>สินค้า</Tag>
          )}
        </div>
      ),
      sorter: (a, b) => a.name.localeCompare(b.name, 'th'),
    },
    {
      title: 'จำนวนในคลัง',
      dataIndex: 'qty',
      align: 'right',
      width: 140,
      sorter: (a, b) => b.qty - a.qty,
      render: (qty) => (
        <span style={{
          fontSize: 14,
          fontWeight: 600,
          color: qty === 0 ? '#cbd5e1' : qty >= 100 ? '#16a34a' : '#0f172a',
        }}>
          {qty.toLocaleString()}
        </span>
      ),
    },
    {
      title: 'สถานะ',
      dataIndex: 'qty',
      width: 90,
      align: 'center',
      render: (qty) =>
        qty > 0
          ? <Tag color="green">มีสต็อก</Tag>
          : <Tag color="default">หมด</Tag>,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Summary bar */}
      <div style={{
        display: 'flex', gap: 24,
        background: '#fff', border: '1px solid #e2e8f0',
        borderRadius: 8, padding: '12px 20px',
      }}>
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

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Input
          prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ค้นหารายการ…"
          allowClear
          style={{ flex: 1, maxWidth: 280 }}
        />
        <Select
          value={sortMode}
          onChange={setSortMode}
          style={{ width: 180 }}
          options={[
            { label: 'เรียง ก–ฮ / A–Z', value: 'az' },
            { label: 'เรียงจากมากไปน้อย', value: 'qty' },
          ]}
        />
        <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
          {filtered.length} รายการ
        </Text>
      </div>

      {/* Table */}
      <Table<RowData>
        columns={columns}
        dataSource={filtered}
        rowKey="key"
        pagination={{ pageSize: 25, showSizeChanger: false, showTotal: (t) => `ทั้งหมด ${t} รายการ` }}
        size="small"
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="ไม่พบรายการ" /> }}
        rowClassName={(row) => row.qty === 0 ? 'opacity-50' : ''}
      />
    </div>
  );
}

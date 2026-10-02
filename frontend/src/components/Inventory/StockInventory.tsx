import { ItemThumbnail } from '../shared/ItemVisual';
import { useMemo, useRef, useState } from 'react';
import { Alert, Button, Input, InputNumber, Segmented, Table, Tag, Empty, Typography, message } from 'antd';
import { CheckOutlined, CloseOutlined, EditOutlined, LockOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType, TableProps } from 'antd/es/table';
import type { Recipe, StockMap, StockImageMap } from '../../types';
import { patchStockItem } from '../../api/client';

const { Text } = Typography;

const STOCK_EDIT_PIN = '7774';
const PIN_LENGTH = 4;

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
  itemNames: Record<string, string>;
  onStockChanged?: () => Promise<void>;
}

// ── PIN lock overlay ──────────────────────────────────────────────────────────
function PinLock({ onUnlocked }: { onUnlocked: () => void }) {
  const [digits, setDigits] = useState(['', '', '', '']);
  const [error, setError] = useState(false);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const handleDigit = (i: number, value: string) => {
    const d = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = d;
    setDigits(next);
    setError(false);
    if (d && i < PIN_LENGTH - 1) refs.current[i + 1]?.focus();
    if (d && i === PIN_LENGTH - 1) {
      if (next.join('') === STOCK_EDIT_PIN) {
        onUnlocked();
      } else {
        setError(true);
        setTimeout(() => { setDigits(['', '', '', '']); setError(false); refs.current[0]?.focus(); }, 600);
      }
    }
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '32px 0' }}>
      <LockOutlined style={{ fontSize: 28, color: '#94a3b8' }} />
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontWeight: 600, fontSize: 15, color: '#0f172a', margin: 0 }}>แก้ไขสต็อก</p>
        <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>ใส่ PIN เพื่อเปิดโหมดแก้ไข</p>
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        {digits.map((digit, i) => (
          <div key={i} style={{ position: 'relative', width: 48, height: 48 }}>
            <input
              ref={(el) => { refs.current[i] = el; }}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              autoFocus={i === 0}
              onChange={(e) => handleDigit(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'text', zIndex: 1 }}
            />
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              border: `2px solid ${error ? '#ef4444' : digit ? '#2563eb' : '#cbd5e1'}`,
              background: error ? '#fef2f2' : digit ? '#eff6ff' : '#f8fafc',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'border-color 0.15s, background 0.15s',
            }}>
              {digit && <div style={{ width: 12, height: 12, borderRadius: '50%', background: error ? '#ef4444' : '#2563eb' }} />}
            </div>
          </div>
        ))}
      </div>
      {error && <p style={{ fontSize: 12, color: '#ef4444', margin: 0 }}>PIN ไม่ถูกต้อง</p>}
    </div>
  );
}

// ── Inline edit cell ──────────────────────────────────────────────────────────
function EditCell({ row, onSave, onCancel, saving }: {
  row: RowData;
  onSave: (newQty: number) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [val, setVal] = useState<number | null>(row.qty);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
      <InputNumber
        autoFocus
        min={0}
        precision={0}
        value={val}
        onChange={setVal}
        size="small"
        style={{ width: 100 }}
        onPressEnter={() => val !== null && onSave(val)}
        formatter={v => v !== undefined ? Number(v).toLocaleString('th-TH') : ''}
        parser={v => Number(v?.replace(/[^0-9]/g, '')) as unknown as 0}
      />
      <Button
        type="primary"
        size="small"
        icon={<CheckOutlined />}
        loading={saving}
        disabled={val === null}
        onClick={() => val !== null && onSave(val)}
      />
      <Button size="small" icon={<CloseOutlined />} onClick={onCancel} disabled={saving} />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function StockInventory({ stocks, stockImages, recipes, itemNames, onStockChanged }: StockInventoryProps) {
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<'available' | 'all' | 'empty'>('available');
  const [unlocked, setUnlocked] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [localStocks, setLocalStocks] = useState<StockMap>(stocks);
  const [msgApi, ctx] = message.useMessage();

  // Sync when parent stocks change (after save)
  useMemo(() => { setLocalStocks(stocks); }, [stocks]);

  const nameMap = useMemo(() => {
    const m = new Map<string, string>(Object.entries(itemNames));
    for (const r of recipes) {
      m.set(r.id, r.name);
      for (const k of Object.keys(r.ingredients)) {
        if (!m.has(k)) m.set(k, k);
      }
    }
    return m;
  }, [recipes, itemNames]);

  const recipeIds = useMemo(() => new Set(recipes.map((r) => r.id)), [recipes]);

  const rows: RowData[] = useMemo(() => {
    const allKeys = new Set<string>(Object.keys(localStocks));
    return Array.from(allKeys).map((key) => ({
      key,
      name: nameMap.get(key) ?? key,
      qty: localStocks[key] ?? 0,
      isRecipe: recipeIds.has(key),
      image: stockImages[key],
    }));
  }, [localStocks, nameMap, recipeIds, stockImages]);

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
    return [...result].sort((a, b) => a.name.localeCompare(b.name, 'th'));
  }, [rows, search, stockFilter]);

  const totalItems = rows.length;
  const totalQty   = rows.reduce((s, r) => s + r.qty, 0);
  const inStock    = rows.filter((r) => r.qty > 0).length;
  const outOfStock = totalItems - inStock;

  const saveEdit = async (row: RowData, newQty: number) => {
    setSavingKey(row.key);
    try {
      await patchStockItem(row.key, newQty, row.qty);
      setLocalStocks(prev => ({ ...prev, [row.key]: newQty }));
      setEditingKey(null);
      void msgApi.success(`อัพเดต ${row.name} → ${newQty.toLocaleString('th-TH')} ชิ้น`);
      await onStockChanged?.();
    } catch (e) {
      void msgApi.error((e as Error).message);
    } finally {
      setSavingKey(null);
    }
  };

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
      width: unlocked ? 220 : 140,
      sorter: (a, b) => a.qty - b.qty,
      render: (_, row) => {
        if (!unlocked) return <Text strong>{row.qty.toLocaleString('th-TH')}</Text>;
        if (editingKey === row.key) {
          return (
            <EditCell
              row={row}
              onSave={(q) => void saveEdit(row, q)}
              onCancel={() => setEditingKey(null)}
              saving={savingKey === row.key}
            />
          );
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
            <Text strong>{row.qty.toLocaleString('th-TH')}</Text>
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => setEditingKey(row.key)}
              disabled={!!savingKey}
            />
          </div>
        );
      },
    },
    {
      title: 'สถานะ',
      dataIndex: 'qty',
      width: 90,
      align: 'center',
      render: (qty) => qty > 0 ? <Tag color="green">มีสต็อก</Tag> : <Tag color="default">หมด</Tag>,
    },
  ];

  const onChange: TableProps<RowData>['onChange'] = () => {};

  if (!unlocked) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Summary bar */}
        <div style={{ display: 'flex', gap: 24, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 20px' }}>
          {[
            { label: 'รายการทั้งหมด', value: totalItems.toLocaleString() },
            { label: 'มีสต็อก', value: inStock.toLocaleString() },
            { label: 'รวมทุกชิ้น', value: totalQty.toLocaleString() },
          ].map(({ label, value }) => (
            <div key={label}>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 20, fontWeight: 600, color: '#0f172a', lineHeight: 1.2 }}>{value}</div>
            </div>
          ))}
        </div>

        <div className="inventory-toolbar">
           <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 16 }}>
          <PinLock onUnlocked={() => setUnlocked(true)} />
        </div><Input
            prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาชื่อหรือรหัสรายการ"
            allowClear
            className="inventory-search"
          />
          <Segmented
            value={stockFilter}
            onChange={(v) => setStockFilter(v as typeof stockFilter)}
            options={[
              { label: `มีสต็อก (${inStock})`, value: 'available' },
              { label: `ทั้งหมด (${totalItems})`, value: 'all' },
              { label: `หมด (${outOfStock})`, value: 'empty' },
            ]}
          />
          <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>แสดง {filtered.length} รายการ</Text>
        </div>

        <Table<RowData>
          scroll={{ x: 500 }}
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

  // Unlocked mode
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {ctx}

      {/* Summary bar + unlock indicator */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 20px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 24 }}>
          {[
            { label: 'รายการทั้งหมด', value: totalItems.toLocaleString() },
            { label: 'มีสต็อก', value: inStock.toLocaleString() },
            { label: 'รวมทุกชิ้น', value: totalQty.toLocaleString() },
          ].map(({ label, value }) => (
            <div key={label}>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 20, fontWeight: 600, color: '#0f172a', lineHeight: 1.2 }}>{value}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Tag color="green" icon={<EditOutlined />}>โหมดแก้ไข</Tag>
          <Button size="small" onClick={() => { setUnlocked(false); setEditingKey(null); }}>ล็อคอีกครั้ง</Button>
        </div>
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
          value={stockFilter}
          onChange={(v) => setStockFilter(v as typeof stockFilter)}
          options={[
            { label: `มีสต็อก (${inStock})`, value: 'available' },
            { label: `ทั้งหมด (${totalItems})`, value: 'all' },
            { label: `หมด (${outOfStock})`, value: 'empty' },
          ]}
        />
        <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>แสดง {filtered.length} รายการ</Text>
      </div>

      <Alert
        type="warning"
        showIcon
        message="โหมดแก้ไขสต็อก"
        description="กดปุ่ม ✏️ ข้างจำนวน เพื่อแก้ค่าโดยตรง การเปลี่ยนแปลงจะบันทึกทันทีและไม่สร้างประวัติการซื้อ"
        style={{ fontSize: 12 }}
      />

      <Table<RowData>
        scroll={{ x: 600 }}
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

import { ItemLabel } from '../shared/ItemVisual';
/**
 * BudgetHistory.tsx
 *
 * Read-only view for the "งบประมาณ" nav page.
 * Shows only:
 *   - Budget summary (used / limit per currency)
 *   - Purchase history table
 */
import { useEffect, useState } from 'react';
import { Table, Tag, Typography, Spin, Alert, Divider, Button, Modal, InputNumber } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Budget, Currency, Recipe, StockPurchase } from '../../types';
import { fetchBudgetData, saveBudget } from '../../api/client';
import { BudgetPinModal } from './BudgetPinModal';

const { Text } = Typography;

function displayMoney(amount: number, currency: Currency) {
  return currency === 'THB'
    ? `฿${amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `${amount.toLocaleString('th-TH')} G`;
}

interface BudgetHistoryProps {
  recipes: Recipe[];
}

export function BudgetHistory({ recipes }: BudgetHistoryProps) {
  const [budgets, setBudgets]     = useState<Budget[]>([]);
  const [purchases, setPurchases] = useState<StockPurchase[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [pendingCurrency, setPendingCurrency] = useState<Currency | null>(null);
  const [editing, setEditing] = useState<{ currency: Currency; pin: string } | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const save = async () => {
    if (!editing || amount === null || !Number.isFinite(amount) || amount < 0) return;
    setSaving(true); setEditError('');
    try {
      const budget = await saveBudget(editing.currency, amount, editing.pin);
      setBudgets(current => [...current.filter(b => b.currency !== budget.currency), budget]);
      setEditing(null);
    } catch (e) { setEditError((e as Error).message); }
    finally { setSaving(false); }
  };

  const itemName = (id: string) => recipes.find((r) => r.id === id)?.name ?? id;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchBudgetData();
        if (cancelled) return;
        setBudgets(data.budgets);
        setPurchases(data.purchases);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin /></div>;
  if (error)   return <Alert type="error" showIcon message="โหลดข้อมูลงบไม่สำเร็จ" description={error} />;

  const spent = (currency: Currency) =>
    purchases.filter((p) => p.currency === currency).reduce((s, p) => s + p.total_amount, 0);

  // ── Summary cards ─────────────────────────────────────────────────────────
  const currencies: Currency[] = ['THB', 'G'];

  // ── Purchase columns ──────────────────────────────────────────────────────
  const columns: ColumnsType<StockPurchase> = [
    {
      title: 'รายการ',
      dataIndex: 'item_id',
      render: (id) => <ItemLabel id={id} name={itemName(id)} size={32} reserveImage />,
    },
    {
      title: 'เพิ่มสต็อก',
      dataIndex: 'quantity',
      align: 'right',
      width: 110,
      render: (v) => `+${v} ชิ้น`,
    },
    {
      title: 'จ่ายทั้งหมด',
      dataIndex: 'total_amount',
      align: 'right',
      width: 140,
      render: (v, row) => <Text strong>{displayMoney(v, row.currency)}</Text>,
    },
    {
      title: 'ต้นทุน/ชิ้น',
      align: 'right',
      width: 130,
      render: (_, row) => displayMoney(row.total_amount / row.quantity, row.currency),
    },
    {
      title: 'งบจาก',
      dataIndex: 'contributor',
      width: 130,
      render: (v) =>
        v ? <Text strong style={{ color: '#2563eb' }}>{v}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: 'แหล่งซื้อ',
      dataIndex: 'source',
      width: 140,
      render: (v) => v || '—',
    },
    {
      title: 'เมื่อ',
      dataIndex: 'purchased_at',
      width: 145,
      render: (v) =>
        new Date(v).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {pendingCurrency && <BudgetPinModal onCancel={() => setPendingCurrency(null)} onVerified={pin => {
        setAmount(budgets.find(b => b.currency === pendingCurrency)?.limit_amount ?? 0);
        setEditing({ currency: pendingCurrency, pin }); setEditError(''); setPendingCurrency(null);
      }} />}
      <Modal open={!!editing} title={`แก้ไขวงเงินงบ ${editing?.currency ?? ''}`} okText="บันทึก" cancelText="ยกเลิก"
        onCancel={() => { if (!saving) setEditing(null); }} onOk={() => void save()} confirmLoading={saving}
        okButtonProps={{ disabled: amount === null || amount < 0 }}>
        <label>วงเงินงบประมาณ
          <InputNumber aria-label="วงเงินงบประมาณ" min={0} value={amount} onChange={setAmount} style={{ width: '100%', marginTop: 8 }} />
        </label>
        {editError && <Alert style={{ marginTop: 12 }} type="error" message={editError} />}
      </Modal>

      {/* Budget summary */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {currencies.map((cur) => {
          const limit = budgets.find((b) => b.currency === cur)?.limit_amount;
          const used  = spent(cur);
          const over  = limit !== undefined && used > limit;
          return (
            <div key={cur} style={{
              flex: 1, minWidth: 200,
              background: '#fff', border: `1px solid ${over ? '#fecaca' : '#e2e8f0'}`,
              borderRadius: 8, padding: '14px 18px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Tag color={cur === 'THB' ? 'blue' : 'purple'} style={{ fontWeight: 600 }}>
                  {cur === 'THB' ? 'เงินบาท (THB)' : 'เหรียญในเกม (G)'}
                </Tag>
                {over && <Tag color="red">เกินงบ</Tag>}
                <Button size="small" onClick={() => setPendingCurrency(cur)}>แก้ไขงบ</Button>
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: over ? '#dc2626' : '#0f172a' }}>
                {displayMoney(used, cur)}
              </div>
              {limit !== undefined && (
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                  จากงบ {displayMoney(limit, cur)}
                  {' · '}
                  คงเหลือ{' '}
                  <span style={{ color: over ? '#dc2626' : '#16a34a', fontWeight: 500 }}>
                    {displayMoney(Math.max(0, limit - used), cur)}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Divider style={{ margin: '4px 0' }} />

      {/* History table */}
      <div>
        <div style={{ marginBottom: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#0f172a' }}>ประวัติการซื้อ</span>
          <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 8 }}>{purchases.length} รายการล่าสุด</span>
        </div>
        <Table
          scroll={{ x: 880 }}
          columns={columns}
          dataSource={purchases}
          rowKey="id"
          pagination={{ pageSize: 15, showSizeChanger: false }}
          size="small"
          locale={{ emptyText: 'ยังไม่มีประวัติการซื้อ' }}
        />
      </div>
    </div>
  );
}

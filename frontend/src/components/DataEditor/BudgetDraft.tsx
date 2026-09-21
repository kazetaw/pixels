import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Input, InputNumber, Select, Space, Spin, Table, Tag, Typography, message } from 'antd';
import { SaveOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { Budget, Currency, Recipe, StockMap, StockPurchase } from '../../types';
import { createStockPurchase, fetchBudgetData, saveBudget } from '../../api/client';

const { Text } = Typography;
const currencies: Currency[] = ['THB', 'G'];

function displayMoney(amount: number, currency: Currency) {
  return currency === 'THB'
    ? `฿${amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `${amount.toLocaleString('th-TH')} G`;
}

interface BudgetDraftProps {
  stocks: StockMap;
  recipes: Recipe[];
  onStockChanged: () => Promise<void>;
}

export function BudgetDraft({ stocks, recipes, onStockChanged }: BudgetDraftProps) {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [purchases, setPurchases] = useState<StockPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingCurrency, setSavingCurrency] = useState<Currency | null>(null);
  const [buying, setBuying] = useState(false);
  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [total, setTotal] = useState<number>(0);
  const [currency, setCurrency] = useState<Currency>('THB');
  const [source, setSource] = useState('');
  const [contributor, setContributor] = useState('');
  const [limitInput, setLimitInput] = useState<Record<Currency, number>>({ THB: 0, G: 0 });
  const [messageApi, contextHolder] = message.useMessage();

  const itemName = (id: string) => recipes.find((recipe) => recipe.id === id)?.name ?? id;

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchBudgetData();
      setBudgets(data.budgets);
      setPurchases(data.purchases);
      setLimitInput({
        THB: data.budgets.find((budget) => budget.currency === 'THB')?.limit_amount ?? 0,
        G: data.budgets.find((budget) => budget.currency === 'G')?.limit_amount ?? 0,
      });
    } catch (error) {
      messageApi.error((error as Error).message || 'โหลดข้อมูลงบประมาณไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const itemOptions = useMemo(() => {
    const recipeMap = new Map(recipes.map((recipe) => [recipe.id, recipe.name]));
    return Array.from(new Set([...Object.keys(stocks), ...recipes.map((recipe) => recipe.id)]))
      .sort((a, b) => itemName(a).localeCompare(itemName(b), 'th'))
      .map((id) => ({ value: id, label: recipeMap.get(id) ?? id }));
  }, [recipes, stocks]);

  const spent = (target: Currency) => purchases.filter((purchase) => purchase.currency === target).reduce((sum, purchase) => sum + purchase.total_amount, 0);
  const limitFor = (target: Currency) => budgets.find((budget) => budget.currency === target)?.limit_amount;

  // สรุปยอดแยกรายผู้ให้งบ
  const contributorBreakdown = (target: Currency): { name: string; total: number }[] => {
    const map = new Map<string, number>();
    purchases
      .filter((p) => p.currency === target)
      .forEach((p) => {
        const key = p.contributor?.trim() || '(ไม่ระบุ)';
        map.set(key, (map.get(key) ?? 0) + p.total_amount);
      });
    return Array.from(map.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);
  };
  const unitCost = quantity > 0 ? total / quantity : 0;

  const saveLimit = async (target: Currency) => {
    setSavingCurrency(target);
    try {
      const budget = await saveBudget(target, limitInput[target] ?? 0);
      setBudgets((current) => [...current.filter((entry) => entry.currency !== target), budget]);
      messageApi.success(`บันทึกงบ ${target} แล้ว`);
    } catch (error) {
      messageApi.error((error as Error).message || 'บันทึกงบไม่สำเร็จ');
    } finally {
      setSavingCurrency(null);
    }
  };

  const addPurchase = async () => {
    if (!itemId || quantity <= 0 || total < 0) return;
    setBuying(true);
    try {
      const purchase = await createStockPurchase({ item_id: itemId, quantity, total_amount: total, currency, source: source.trim() || undefined, contributor: contributor.trim() || undefined });
      setPurchases((current) => [purchase, ...current]);
      await onStockChanged();
      setQuantity(1); setTotal(0); setSource(''); setContributor('');
      messageApi.success(`เพิ่ม ${itemName(itemId)} ${purchase.quantity} ชิ้นในสต็อกแล้ว`);
    } catch (error) {
      messageApi.error((error as Error).message || 'บันทึกรายการซื้อไม่สำเร็จ');
    } finally {
      setBuying(false);
    }
  };

  const columns: ColumnsType<StockPurchase> = [
    { title: 'รายการ', dataIndex: 'item_id', render: (id) => <Text strong>{itemName(id)}</Text> },
    { title: 'เพิ่มสต็อก', dataIndex: 'quantity', align: 'right', width: 108, render: (value) => `+${value} ชิ้น` },
    { title: 'จ่ายทั้งหมด', dataIndex: 'total_amount', align: 'right', width: 140, render: (value, row) => <Text strong>{displayMoney(value, row.currency)}</Text> },
    { title: 'ต้นทุน/ชิ้น', align: 'right', width: 130, render: (_, row) => displayMoney(row.total_amount / row.quantity, row.currency) },
    { title: 'งบจาก', dataIndex: 'contributor', width: 130, render: (value) => value ? <Text strong style={{ color: '#2563eb' }}>{value}</Text> : <Text type="secondary">—</Text> },
    { title: 'แหล่งซื้อ', dataIndex: 'source', width: 140, render: (value) => value || '—' },
    { title: 'เมื่อ', dataIndex: 'purchased_at', width: 145, render: (value) => new Date(value).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {contextHolder}
      <Alert type="info" showIcon message="ทุกการซื้อเพิ่มสต็อกและบันทึกรายจ่ายในรายการเดียว" description="THB และ G แยกงบกันโดยสมบูรณ์ ระบบจะไม่แปลงค่าเงินเอง" />

      {loading ? <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div> : <>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.15fr) minmax(280px, .85fr)', gap: 16, alignItems: 'start' }}>
          <Card title="ซื้อเพื่อเติมสต็อก" size="small">
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 110px', gap: 12, marginBottom: 12 }}>
              <label><span className="budget-field-label">รายการ</span><Select showSearch value={itemId || undefined} onChange={setItemId} placeholder="เลือกรายการ" options={itemOptions} style={{ width: '100%' }} /></label>
              <label><span className="budget-field-label">จำนวนที่ซื้อ</span><InputNumber min={1} value={quantity} onChange={(value) => setQuantity(value ?? 1)} style={{ width: '100%' }} /></label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 120px', gap: 12, marginBottom: 12 }}>
              <label><span className="budget-field-label">จ่ายทั้งหมด</span><InputNumber min={0} value={total} onChange={(value) => setTotal(value ?? 0)} style={{ width: '100%' }} /></label>
              <label><span className="budget-field-label">สกุลเงิน</span><Select value={currency} onChange={setCurrency} options={[{ value: 'THB', label: 'THB · บาท' }, { value: 'G', label: 'G · เหรียญเกม' }]} style={{ width: '100%' }} /></label>
            </div>
            <label style={{ display: 'block', marginBottom: 14 }}><span className="budget-field-label">แหล่งซื้อ / หมายเหตุ</span><Input value={source} onChange={(event) => setSource(event.target.value)} placeholder={currency === 'THB' ? 'เช่น ตลาด' : 'เช่น ร้านค้าในเกม'} /></label>
            <label style={{ display: 'block', marginBottom: 14 }}><span className="budget-field-label">งบจาก (ผู้ให้งบ)</span><Input value={contributor} onChange={(event) => setContributor(event.target.value)} placeholder="เช่น แม่, กองกลาง, ส่วนตัว" /></label>
            <div className="budget-unit-cost"><Text type="secondary" style={{ fontSize: 12 }}>ต้นทุนต่อชิ้น</Text><Text strong>{displayMoney(unitCost, currency)} / ชิ้น</Text></div>
            <Button type="primary" icon={<ShoppingCartOutlined />} onClick={() => void addPurchase()} loading={buying} disabled={!itemId || quantity <= 0}>เพิ่มสต็อกและบันทึกรายจ่าย</Button>
          </Card>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Card title="งบประมาณ" size="small">
              <Space direction="vertical" size={14} style={{ width: '100%' }}>
                {currencies.map((target) => {
                  const limit = limitFor(target);
                  const used = spent(target);
                  return <div key={target}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><Text strong>{target === 'THB' ? 'เงินบาท (THB)' : 'เหรียญในเกม (G)'}</Text><Text type="secondary" style={{ fontSize: 12 }}>ใช้ {displayMoney(used, target)}</Text></div>
                    <Space.Compact style={{ width: '100%' }}><InputNumber min={0} value={limitInput[target]} onChange={(value) => setLimitInput((current) => ({ ...current, [target]: value ?? 0 }))} style={{ width: '100%' }} /><Button icon={<SaveOutlined />} loading={savingCurrency === target} onClick={() => void saveLimit(target)}>บันทึก</Button></Space.Compact>
                    {limit !== undefined && <Text type={used > limit ? 'danger' : 'secondary'} style={{ fontSize: 12 }}>คงเหลือ {displayMoney(Math.max(0, limit - used), target)} จากงบ {displayMoney(limit, target)}</Text>}
                  </div>;
                })}
              </Space>
            </Card>
            <Card size="small" title="หลักการ"><Space direction="vertical" size={6}><Text style={{ fontSize: 12 }}><Tag color="blue">THB</Tag> และ <Tag color="purple">G</Tag> แยกงบ ไม่แปลงค่าเงิน</Text><Text style={{ fontSize: 12 }}>งบที่ตั้งไว้จะกันการซื้อเกินงบตั้งแต่ฝั่งฐานข้อมูล</Text><Text style={{ fontSize: 12 }}>การแก้ยอดสต็อกด้วยมือไม่สร้างรายการรายจ่าย</Text></Space></Card>
          </div>
        </div>

        <div><div style={{ marginBottom: 8 }}><h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#0f172a' }}>ประวัติการซื้อ</h3><p style={{ margin: '3px 0 0', fontSize: 12, color: '#64748b' }}>เก็บ 100 รายการล่าสุด พร้อมจำนวนที่เพิ่มจริงในสต็อก</p></div><Table columns={columns} dataSource={purchases} rowKey="id" pagination={{ pageSize: 10, showSizeChanger: false }} size="small" locale={{ emptyText: 'ยังไม่มีประวัติการซื้อ' }} /></div>
      </>}
    </div>
  );
}

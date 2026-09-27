import { ItemLabel, itemSelectVisuals } from '../shared/ItemVisual';
import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Input, InputNumber, Select, Space, Spin, Table, Tag, Typography, message } from 'antd';
import { DeleteOutlined, PlusOutlined, SaveOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { Budget, Currency, Recipe, StockMap, StockPurchase } from '../../types';
import { createStockPurchase, fetchBudgetData, saveBudget } from '../../api/client';
import { BudgetPinModal } from './BudgetPinModal';
import { PurchaseEditButton } from './PurchaseEditButton';
import { PURCHASE_SOURCE_OPTIONS } from './purchaseOptions';
import { contributorLabel, CONTRIBUTOR_NAMES } from '../shared/contributors';
import { getBudgetSessionPin } from './budgetPinSession';

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
  itemNames: Record<string, string>;
  onStockChanged: () => Promise<void>;
}

interface QueuedPurchase {
  key: string;
  itemId: string;
  quantity: number;
  quantityExpression: string;
  total: number;
  currency: Currency;
}

const newQueuedPurchase = (): QueuedPurchase => ({ key: `${Date.now()}-${Math.random().toString(36).slice(2)}`, itemId: '', quantity: 0, quantityExpression: '', total: 0, currency: 'THB' });
const newPurchaseLines = (count = 3) => Array.from({ length: count }, newQueuedPurchase);

/** Allow quick stack arithmetic such as "99 + 22", while persisting only its numeric result. */
function parseQuantityExpression(expression: string): number | null {
  const compact = expression.trim();
  if (!compact) return 0;
  if (!/^\d+(?:\s*\+\s*\d+)*$/.test(compact)) return null;
  const total = compact.split('+').reduce((sum, part) => sum + Number(part.trim()), 0);
  return Number.isSafeInteger(total) ? total : null;
}

export function BudgetDraft({ stocks, recipes, itemNames, onStockChanged }: BudgetDraftProps) {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [purchases, setPurchases] = useState<StockPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingCurrency, setSavingCurrency] = useState<Currency | null>(null);
  const [pendingCurrency, setPendingCurrency] = useState<Currency | null>(null);
  const [buying, setBuying] = useState(false);
  const [source, setSource] = useState('');
  const [contributor, setContributor] = useState('');
  const [queuedPurchases, setQueuedPurchases] = useState<QueuedPurchase[]>(() => newPurchaseLines());
  const [limitInput, setLimitInput] = useState<Record<Currency, number>>({ THB: 0, G: 0 });
  const [messageApi, contextHolder] = message.useMessage();

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const itemName = (id: string) => {
    const n = itemNames[id];
    return (n && !UUID_RE.test(n)) ? n : recipes.find((recipe) => recipe.id === id)?.name ?? 'ไม่พบชื่อสินค้า';
  };

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
    const itemIds = new Set([
      ...Object.keys(stocks),
      ...recipes.map((recipe) => recipe.id),
      ...recipes.flatMap((recipe) => Object.keys(recipe.ingredients)),
    ]);
    return Array.from(itemIds)
      .map((id) => {
        const fromNames = itemNames[id];
        // ถ้า itemNames เก็บ UUID ไว้ผิดๆ ให้ข้ามแล้วไป fallback
        const resolvedName =
          fromNames && !UUID_RE.test(fromNames)
            ? fromNames
            : recipeMap.get(id) ?? 'ไม่พบชื่อสินค้า';
        return { value: id, label: resolvedName };
      })
      .sort((a, b) => a.label.localeCompare(b.label, 'th'));
  }, [recipes, stocks, itemNames]);

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
  const validQueuedPurchases = queuedPurchases.filter((entry) => entry.itemId && entry.quantity > 0);
  const incompleteQueuedPurchases = queuedPurchases.filter((entry) => (entry.itemId || entry.quantity || entry.total) && !(entry.itemId && entry.quantity > 0));

  const saveLimit = async (target: Currency, pin: string) => {
    setSavingCurrency(target);
    try {
      const budget = await saveBudget(target, limitInput[target] ?? 0, pin);
      setBudgets((current) => [...current.filter((entry) => entry.currency !== target), budget]);
      messageApi.success(`บันทึกงบ ${target} แล้ว`);
    } catch (error) {
      messageApi.error((error as Error).message || 'บันทึกงบไม่สำเร็จ');
    } finally {
      setSavingCurrency(null);
    }
  };
  const startSaveLimit = (target: Currency) => {
    const savedPin = getBudgetSessionPin();
    if (savedPin) void saveLimit(target, savedPin); else setPendingCurrency(target);
  };

  const updateQueuedPurchase = (key: string, patch: Partial<QueuedPurchase>) => setQueuedPurchases((current) => current.map((entry) => entry.key === key ? { ...entry, ...patch } : entry));
  const addPurchaseLine = () => setQueuedPurchases((current) => [...current, newQueuedPurchase()]);
  const removePurchaseLine = (key: string) => setQueuedPurchases((current) => current.length === 1 ? [newQueuedPurchase()] : current.filter((entry) => entry.key !== key));
  const setQuantityExpression = (entry: QueuedPurchase, quantityExpression: string) => {
    updateQueuedPurchase(entry.key, { quantityExpression, quantity: parseQuantityExpression(quantityExpression) ?? 0 });
  };
  const finalizeQuantityExpression = (entry: QueuedPurchase) => {
    const quantity = parseQuantityExpression(entry.quantityExpression);
    if (quantity !== null && entry.quantityExpression.trim()) updateQueuedPurchase(entry.key, { quantity, quantityExpression: String(quantity) });
  };
  const appendNinetyNine = (entry: QueuedPurchase) => {
    // The shortcut is for quick entry, so show the new total immediately instead
    // of leaving a growing expression such as "99 + 99 + 99" in the field.
    const quantity = parseQuantityExpression(entry.quantityExpression) ?? entry.quantity;
    const next = quantity + 99;
    updateQueuedPurchase(entry.key, { quantity: next, quantityExpression: String(next) });
  };

  const saveQueuedPurchases = async () => {
    if (!validQueuedPurchases.length) return;
    if (incompleteQueuedPurchases.length) {
      messageApi.error('กรอกสินค้าและจำนวนให้ครบ หรือกดลบแถวที่ยังไม่ใช้ก่อนบันทึก');
      return;
    }
    setBuying(true);
    const saved: StockPurchase[] = [];
    const savedKeys: string[] = [];
    try {
      for (const entry of validQueuedPurchases) {
        const purchase = await createStockPurchase({
          item_id: entry.itemId, quantity: entry.quantity, total_amount: entry.total, currency: entry.currency,
          source: source.trim() || undefined, contributor: contributor.trim() || undefined,
        });
        saved.push(purchase);
        savedKeys.push(entry.key);
      }
      setPurchases((current) => [...saved, ...current]);
      setQueuedPurchases(newPurchaseLines());
      await onStockChanged();
      messageApi.success(`เพิ่มสต็อก ${saved.length} รายการแล้ว`);
    } catch (error) {
      if (saved.length) {
        setPurchases((current) => [...saved, ...current]);
        setQueuedPurchases((current) => current.filter((entry) => !savedKeys.includes(entry.key)));
        await onStockChanged();
      }
      const rawMessage = (error as Error).message || 'บันทึกรายการซื้อไม่สำเร็จ';
      const currencyMatch = rawMessage.match(/Budget exceeded for (THB|G)/);
      const friendlyMessage = currencyMatch
        ? `ฐานข้อมูลยังใช้กติกางบแบบเก่า · รัน migration ปลดการล็อกงบก่อน`
        : rawMessage;
      messageApi.error(`${saved.length ? `บันทึกแล้ว ${saved.length} รายการ · ` : ''}${friendlyMessage}`);
    } finally {
      setBuying(false);
    }
  };

  const columns: ColumnsType<StockPurchase> = [
    { title: 'จัดการ', key: 'edit', width: 95, fixed: 'right', render: (_, row) =>
      <PurchaseEditButton purchase={row} itemNames={itemNames} onSaved={updated => {
        setPurchases(current => current.map(p => p.id === updated.id ? updated : p)
          .sort((a, b) => Date.parse(b.purchased_at) - Date.parse(a.purchased_at)));
        void onStockChanged().catch(e => messageApi.error((e as Error).message));
      }} /> },
    { title: 'รายการ', dataIndex: 'item_id', render: (id) => <ItemLabel id={id} name={itemName(id)} size={32} reserveImage /> },
    { title: 'เพิ่มสต็อก', dataIndex: 'quantity', align: 'right', width: 108, render: (value) => `+${value} ชิ้น` },
    { title: 'จ่ายทั้งหมด', dataIndex: 'total_amount', align: 'right', width: 140, render: (value, row) => <Text strong>{displayMoney(value, row.currency)}</Text> },
    { title: 'ต้นทุน/ชิ้น', align: 'right', width: 130, render: (_, row) => displayMoney(row.total_amount / row.quantity, row.currency) },
    { title: 'งบจาก', dataIndex: 'contributor', width: 150, render: (value) => value ? <Text strong style={{ color: '#2563eb' }}>{contributorLabel(value)}</Text> : <Text type="secondary">—</Text> },
    { title: 'แหล่งซื้อ', dataIndex: 'source', width: 140, render: (value) => value || '—' },
    { title: 'เมื่อ', dataIndex: 'purchased_at', width: 145, render: (value) => new Date(value).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {contextHolder}
      {pendingCurrency && <BudgetPinModal onCancel={() => setPendingCurrency(null)} onVerified={pin => {
        const target = pendingCurrency; setPendingCurrency(null); void saveLimit(target, pin);
      }} />}
      {loading ? <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div> : <>
        <div className="budget-content-grid">
          <Card title="ซื้อเพื่อเติมสต็อก" size="small">
            <div className="budget-purchase-context">
              <label><span>งบจาก</span><Input value={contributor} onChange={(event) => setContributor(event.target.value)} placeholder="เลือกหรือพิมพ์ชื่อ" /></label>
              <label><span>แหล่งซื้อ</span><Select value={source || undefined} onChange={(value) => setSource(value)} placeholder="เลือก" options={[...PURCHASE_SOURCE_OPTIONS]} /></label>
              <div className="budget-purchase-people"><span>เลือกคน</span><Space size={[4, 4]} wrap>{CONTRIBUTOR_NAMES.map((name) => <Button key={name} size="small" type={contributor === name ? 'primary' : 'default'} onClick={() => setContributor(name)}>{contributorLabel(name)}</Button>)}</Space></div>
            </div>
            <div className="budget-purchase-lines" aria-label="รายการซื้อรอบนี้">
              <div className="budget-purchase-lines__head"><span>รายการ</span><span>จำนวน</span><span>จ่าย (ฟรี = 0)</span><span>สกุล</span><span /></div>
              {queuedPurchases.map((entry) => <div className="budget-purchase-line" key={entry.key}>
                <Select {...itemSelectVisuals} showSearch optionFilterProp="label" value={entry.itemId || undefined} onChange={(value) => updateQueuedPurchase(entry.key, { itemId: value ?? '' })} placeholder="ค้นหาสินค้า" options={itemOptions} />
                <div><Input value={entry.quantityExpression} inputMode="numeric" onChange={(event) => setQuantityExpression(entry, event.target.value)} onBlur={() => finalizeQuantityExpression(entry)} onPressEnter={(event) => { event.preventDefault(); event.stopPropagation(); finalizeQuantityExpression(entry); }} placeholder="99 + 22" aria-label="จำนวนที่ซื้อ" /><Button size="small" type="text" onClick={() => appendNinetyNine(entry)}>+99</Button></div>
                <InputNumber min={0} value={entry.total || undefined} onChange={(value) => updateQueuedPurchase(entry.key, { total: value ?? 0 })} placeholder="ฟรี / 0" />
                <Select value={entry.currency} onChange={(value) => updateQueuedPurchase(entry.key, { currency: value })} options={[{ value: 'THB', label: 'บาท' }, { value: 'G', label: 'G' }]} />
                <Button type="text" danger aria-label="ลบบรรทัดนี้" icon={<DeleteOutlined />} onClick={() => removePurchaseLine(entry.key)} />
              </div>)}
            </div>
            <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={addPurchaseLine} style={{ marginTop: 9 }}>เพิ่มบรรทัด</Button>
            <div className="budget-purchase-save"><div><strong>{validQueuedPurchases.length} รายการพร้อมบันทึก</strong><span>เกินงบได้ · ช่องจ่ายปล่อยว่างได้สำหรับของฟรี</span></div><Button type="primary" icon={<ShoppingCartOutlined />} loading={buying} disabled={!validQueuedPurchases.length} onClick={() => void saveQueuedPurchases()}>บันทึกทั้งหมด</Button></div>
          </Card>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Card title="งบประมาณ" size="small">
              <Space direction="vertical" size={14} style={{ width: '100%' }}>
                {currencies.map((target) => {
                  const limit = limitFor(target);
                  const used = spent(target);
                  const breakdown = contributorBreakdown(target);
                  return <div key={target}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><Text strong>{target === 'THB' ? 'เงินบาท (THB)' : 'เหรียญในเกม (G)'}</Text><Text type="secondary" style={{ fontSize: 12 }}>ใช้ {displayMoney(used, target)}</Text></div>
                    <Space.Compact style={{ width: '100%' }}><InputNumber min={0} value={limitInput[target]} onChange={(value) => setLimitInput((current) => ({ ...current, [target]: value ?? 0 }))} style={{ width: '100%' }} /><Button icon={<SaveOutlined />} loading={savingCurrency === target} onClick={() => startSaveLimit(target)}>บันทึก</Button></Space.Compact>
                    {limit !== undefined && <Text type={used > limit ? 'danger' : 'secondary'} style={{ fontSize: 12 }}>คงเหลือ {displayMoney(Math.max(0, limit - used), target)} จากงบ {displayMoney(limit, target)}</Text>}
                    {breakdown.length > 0 && (
                      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <Text type="secondary" style={{ fontSize: 11 }}>งบได้มาจาก</Text>
                        {breakdown.map(({ name, total: t }) => (
                          <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={{ fontSize: 12 }}>{contributorLabel(name)}</Text>
                            <Text strong style={{ fontSize: 12, color: '#2563eb' }}>{displayMoney(t, target)}</Text>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>;
                })}
              </Space>
            </Card>
            <Card size="small" title="หลักการ"><Space direction="vertical" size={6}><Text style={{ fontSize: 12 }}><Tag color="blue">THB</Tag> และ <Tag color="purple">G</Tag> แยกงบ ไม่แปลงค่าเงิน</Text><Text style={{ fontSize: 12 }}>งบใช้ติดตามยอดได้ แต่ไม่ล็อกการซื้อเมื่อเกินวงเงิน</Text><Text style={{ fontSize: 12 }}>ช่องจ่ายปล่อยว่างได้ ระบบบันทึกเป็น 0 สำหรับของฟรี</Text></Space></Card>
          </div>
        </div>

        <div><div style={{ marginBottom: 8 }}><h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#0f172a' }}>ประวัติการซื้อ</h3><p style={{ margin: '3px 0 0', fontSize: 12, color: '#64748b' }}>เก็บ 100 รายการล่าสุด พร้อมจำนวนที่เพิ่มจริงในสต็อก</p></div><Table scroll={{ x: 880 }} columns={columns} dataSource={purchases} rowKey="id" pagination={{ pageSize: 10, showSizeChanger: false }} size="small" locale={{ emptyText: 'ยังไม่มีประวัติการซื้อ' }} /></div>
      </>}
    </div>
  );
}

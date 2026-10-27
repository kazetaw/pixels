import { useEffect, useRef, useState } from 'react';
import { Button, InputNumber, Input, Modal, Select, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { fetchAllData } from '../../api/client';
import type { AppData } from '../../types';

// ── Types ────────────────────────────────────────────────────────────────────

type SaleRecord = {
  id: string;
  item_id: string;
  item_name: string;
  qty: number;
  price_per_unit: number;
  total: number;
  sold_at: string;
};

type RestockRecord = {
  id: string;
  item_id: string;
  item_name: string;
  qty: number;
  note: string;
  restocked_at: string;
};

// ── Constants ────────────────────────────────────────────────────────────────

const STORE_PIN = '3333';
const PIN_LENGTH = 4;
const LS_VERIFIED = 'store-pin-verified';
const LS_PRICES = 'store-prices';
const LS_SALES = 'store-sales';
const LS_RESTOCKS = 'store-restocks';

function readLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeLS(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* ignore */ }
}

// ── PIN Gate ──────────────────────────────────────────────────────────────────

function PinGate({ onVerified }: { onVerified: () => void }) {
  const [digits, setDigits] = useState<string[]>(['', '', '', '']);
  const [error, setError] = useState(false);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const handleDigit = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    setError(false);

    if (digit && index < PIN_LENGTH - 1) {
      refs.current[index + 1]?.focus();
    }

    if (digit && index === PIN_LENGTH - 1) {
      const entered = next.join('');
      if (entered === STORE_PIN) {
        try { localStorage.setItem(LS_VERIFIED, '1'); } catch { /* ignore */ }
        onVerified();
      } else {
        setError(true);
        setTimeout(() => {
          setDigits(['', '', '', '']);
          setError(false);
          refs.current[0]?.focus();
        }, 600);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  return (
    <div className="store-pin-gate">
      <div style={{ background: '#fff', borderRadius: 16, padding: '40px 32px', boxShadow: '0 4px 24px rgba(0,0,0,.08)', textAlign: 'center', minWidth: 280 }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 22 }}>🔑</div>
        <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, color: '#0f172a' }}>ร้านค้า</h2>
        <p style={{ margin: '0 0 24px', fontSize: 13, color: '#64748b' }}>กรอก PIN เพื่อเข้าใช้งาน</p>

        {/* Dot display */}
        <div className="store-pin-dots" style={{ justifyContent: 'center', marginBottom: 24 }}>
          {digits.map((d, i) => (
            <div key={i} style={{ position: 'relative', width: 52, height: 52 }}>
              {/* Circle background */}
              <div style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                border: `2px solid ${error ? '#ef4444' : '#e2e8f0'}`,
                background: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {d && (
                  <div style={{
                    width: 12, height: 12, borderRadius: '50%',
                    background: error ? '#ef4444' : '#4f46e5',
                  }} />
                )}
              </div>
              {/* Hidden input */}
              <input
                ref={el => { refs.current[i] = el; }}
                type="password"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={e => handleDigit(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                style={{
                  position: 'absolute', inset: 0, opacity: 0,
                  width: '100%', height: '100%', cursor: 'text',
                }}
                aria-label={`PIN หลักที่ ${i + 1}`}
              />
            </div>
          ))}
        </div>

        {error && (
          <p style={{ margin: 0, fontSize: 13, color: '#ef4444' }}>PIN ไม่ถูกต้อง</p>
        )}
      </div>
    </div>
  );
}

// ── Item image helper ──────────────────────────────────────────────────────

function ItemImg({ src, name, size = 40 }: { src?: string; name: string; size?: number }) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        style={{ width: size, height: size, objectFit: 'contain', borderRadius: 6, background: '#f1f5f9', flexShrink: 0 }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: 6, background: '#f1f5f9',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.45, color: '#cbd5e1', flexShrink: 0,
    }}>
      📦
    </div>
  );
}

// ── Main StorePage ─────────────────────────────────────────────────────────

export function StorePage() {
  const [verified, setVerified] = useState(() => {
    try { return localStorage.getItem(LS_VERIFIED) === '1'; } catch { return false; }
  });

  const [tab, setTab] = useState<'overview' | 'restock' | 'sales'>('overview');
  const [apiData, setApiData] = useState<AppData | null>(null);
  const [localStock, setLocalStock] = useState<Record<string, number>>({});
  const [prices, setPrices] = useState<Record<string, number>>(() => readLS(LS_PRICES, {}));
  const [sales, setSales] = useState<SaleRecord[]>(() => readLS(LS_SALES, []));
  const [restocks, setRestocks] = useState<RestockRecord[]>(() => readLS(LS_RESTOCKS, []));

  // Sell modal state
  const [sellItem, setSellItem] = useState<{ id: string; name: string } | null>(null);
  const [sellQty, setSellQty] = useState<number>(1);

  // Restock form state
  const [restockItemId, setRestockItemId] = useState<string | undefined>();
  const [restockQty, setRestockQty] = useState<number | null>(1);
  const [restockNote, setRestockNote] = useState('');

  // Load API data on mount
  useEffect(() => {
    if (!verified) return;
    fetchAllData().then(data => setApiData(data)).catch(() => { /* silent — stock shows 0 */ });
  }, [verified]);

  // Initialise localStock from API data — only once; do NOT reset on re-fetch
  const stockInitialised = useRef(false);
  useEffect(() => {
    if (apiData && !stockInitialised.current) {
      stockInitialised.current = true;
      setLocalStock({ ...apiData.stocks });
    }
  }, [apiData]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const savePrice = (itemId: string, price: number) => {
    const next = { ...prices, [itemId]: price };
    setPrices(next);
    writeLS(LS_PRICES, next);
  };

  const addSale = (sale: SaleRecord) => {
    const next = [sale, ...sales];
    setSales(next);
    writeLS(LS_SALES, next);
    setLocalStock(prev => ({ ...prev, [sale.item_id]: Math.max(0, (prev[sale.item_id] ?? 0) - sale.qty) }));
  };

  const addRestock = (record: RestockRecord) => {
    const next = [record, ...restocks];
    setRestocks(next);
    writeLS(LS_RESTOCKS, next);
    setLocalStock(prev => ({ ...prev, [record.item_id]: (prev[record.item_id] ?? 0) + record.qty }));
  };

  const deleteSale = (id: string) => {
    const next = sales.filter(s => s.id !== id);
    setSales(next);
    writeLS(LS_SALES, next);
  };

  // ── Summary stats ──────────────────────────────────────────────────────────

  const totalItems = Object.values(localStock).filter(v => v > 0).length;
  const totalStock = Object.values(localStock).reduce((s, v) => s + v, 0);
  const totalRevenue = sales.reduce((s, r) => s + r.total, 0);

  // ── Sell modal ─────────────────────────────────────────────────────────────

  const handleSellConfirm = () => {
    if (!sellItem || !sellQty || sellQty < 1) return;
    const pricePerUnit = prices[sellItem.id] ?? 0;
    addSale({
      id: crypto.randomUUID(),
      item_id: sellItem.id,
      item_name: sellItem.name,
      qty: sellQty,
      price_per_unit: pricePerUnit,
      total: pricePerUnit * sellQty,
      sold_at: new Date().toISOString(),
    });
    setSellItem(null);
    setSellQty(1);
  };

  // ── Restock form ───────────────────────────────────────────────────────────

  const handleRestock = () => {
    if (!restockItemId || !restockQty || restockQty < 1) return;
    const name = apiData?.itemNames[restockItemId] ?? 'ไม่พบชื่อสินค้า';
    addRestock({
      id: crypto.randomUUID(),
      item_id: restockItemId,
      item_name: name,
      qty: restockQty,
      note: restockNote.trim(),
      restocked_at: new Date().toISOString(),
    });
    setRestockItemId(undefined);
    setRestockQty(1);
    setRestockNote('');
  };

  // ── Sales table columns ────────────────────────────────────────────────────

  const salesColumns: ColumnsType<SaleRecord> = [
    {
      title: 'วันที่/เวลา',
      dataIndex: 'sold_at',
      key: 'sold_at',
      width: 140,
      render: (v: string) => new Date(v).toLocaleString('th-TH'),
    },
    {
      title: 'สินค้า',
      key: 'item',
      render: (_: unknown, r: SaleRecord) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ItemImg src={apiData?.stockImages[r.item_id]} name={r.item_name} size={28} />
          <span style={{ fontSize: 13 }}>{r.item_name}</span>
        </div>
      ),
    },
    {
      title: 'จำนวน',
      dataIndex: 'qty',
      key: 'qty',
      width: 72,
      align: 'right' as const,
    },
    {
      title: 'ราคา/หน่วย',
      dataIndex: 'price_per_unit',
      key: 'price_per_unit',
      width: 100,
      align: 'right' as const,
      render: (v: number) => v.toLocaleString('th-TH'),
    },
    {
      title: 'รวม',
      dataIndex: 'total',
      key: 'total',
      width: 100,
      align: 'right' as const,
      render: (v: number) => v.toLocaleString('th-TH'),
    },
    {
      title: 'ลบ',
      key: 'delete',
      width: 60,
      align: 'center' as const,
      render: (_: unknown, r: SaleRecord) => (
        <Button danger size="small" onClick={() => deleteSale(r.id)}>ลบ</Button>
      ),
    },
  ];

  // ── Items list for dropdowns ───────────────────────────────────────────────

  const itemOptions = Object.entries(apiData?.itemNames ?? {}).map(([id, name]) => ({
    value: id,
    label: name,
  }));

  // ── Guard: PIN ─────────────────────────────────────────────────────────────

  if (!verified) {
    return <PinGate onVerified={() => setVerified(true)} />;
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="store-page">
      {/* Top navbar */}
      <nav className="store-navbar" aria-label="ร้านค้า">
        <span className="store-navbar__title">ร้านค้า</span>
        <div className="store-navbar__tabs">
          {([
            ['overview', 'ภาพรวม'],
            ['restock', 'เติมสต็อก'],
            ['sales', 'บันทึกการขาย'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              className={`store-navbar__tab${tab === key ? ' is-active' : ''}`}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>

      {/* ── Tab 1: ภาพรวม ── */}
      {tab === 'overview' && (
        <div className="store-tab-content">
          {/* Summary cards */}
          <div className="store-summary-row">
            <div className="store-summary-card">
              <div className="store-summary-card__value">{totalItems.toLocaleString('th-TH')}</div>
              <div className="store-summary-card__label">สินค้าทั้งหมด</div>
            </div>
            <div className="store-summary-card">
              <div className="store-summary-card__value">{totalStock.toLocaleString('th-TH')}</div>
              <div className="store-summary-card__label">สต็อกรวม</div>
            </div>
            <div className="store-summary-card">
              <div className="store-summary-card__value">{totalRevenue.toLocaleString('th-TH')}</div>
              <div className="store-summary-card__label">ยอดขายรวม</div>
            </div>
          </div>

          {/* Product grid */}
          <div className="store-product-grid">
            {Object.entries(apiData?.itemNames ?? {}).map(([id, name]) => {
              const qty = localStock[id] ?? 0;
              const price = prices[id] ?? 0;
              return (
                <div className="store-product-card" key={id}>
                  <ItemImg src={apiData?.stockImages[id]} name={name} size={56} />
                  <div className="store-product-card__name">{name}</div>
                  <div className={`store-product-card__qty${qty <= 0 ? ' is-empty' : ''}`}>
                    {qty <= 0 ? 'หมด' : `${qty.toLocaleString('th-TH')} ชิ้น`}
                  </div>
                  <InputNumber
                    min={0}
                    precision={0}
                    value={price}
                    onChange={v => savePrice(id, v ?? 0)}
                    placeholder="ราคา"
                    addonBefore="฿"
                    size="small"
                    style={{ width: '100%' }}
                    aria-label={`ราคา ${name}`}
                  />
                  <Button
                    type="primary"
                    size="small"
                    disabled={qty <= 0}
                    onClick={() => { setSellItem({ id, name }); setSellQty(1); }}
                    style={{ width: '100%' }}
                  >
                    ขายไป
                  </Button>
                </div>
              );
            })}
          </div>

          {/* Sell modal */}
          <Modal
            open={!!sellItem}
            title={sellItem?.name ?? ''}
            okText="ยืนยันการขาย"
            cancelText="ยกเลิก"
            onOk={handleSellConfirm}
            onCancel={() => setSellItem(null)}
            okButtonProps={{ disabled: !sellQty || sellQty < 1 }}
          >
            {sellItem && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '8px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <ItemImg src={apiData?.stockImages[sellItem.id]} name={sellItem.name} size={40} />
                  <div>
                    <div style={{ fontSize: 13, color: '#64748b' }}>
                      สต็อกคงเหลือ: <strong style={{ color: '#0f172a' }}>{(localStock[sellItem.id] ?? 0).toLocaleString('th-TH')} ชิ้น</strong>
                    </div>
                    <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
                      ราคา/ชิ้น: <strong style={{ color: '#4f46e5' }}>฿{(prices[sellItem.id] ?? 0).toLocaleString('th-TH')}</strong>
                    </div>
                  </div>
                </div>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>จำนวนที่ขาย</span>
                  <InputNumber
                    autoFocus
                    min={1}
                    max={localStock[sellItem.id] ?? 1}
                    precision={0}
                    value={sellQty}
                    onChange={v => setSellQty(v ?? 1)}
                    style={{ width: '100%' }}
                  />
                </label>
                {sellQty > 0 && (
                  <div style={{ padding: '10px 14px', background: '#eef2ff', borderRadius: 8, fontSize: 14, fontWeight: 600, color: '#4f46e5' }}>
                    รวม ฿{((prices[sellItem.id] ?? 0) * sellQty).toLocaleString('th-TH')}
                  </div>
                )}
              </div>
            )}
          </Modal>
        </div>
      )}

      {/* ── Tab 2: เติมสต็อก ── */}
      {tab === 'restock' && (
        <div className="store-tab-content">
          <div className="store-restock-form">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 200, flex: '1 1 200px' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>สินค้า</span>
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="เลือกสินค้า"
                value={restockItemId}
                onChange={setRestockItemId}
                options={itemOptions}
                style={{ width: '100%' }}
                aria-label="เลือกสินค้าเติมสต็อก"
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 100 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>จำนวน</span>
              <InputNumber
                min={1}
                precision={0}
                value={restockQty}
                onChange={setRestockQty}
                style={{ width: '100%' }}
                aria-label="จำนวนที่เติม"
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '2 1 200px' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>หมายเหตุ (ไม่บังคับ)</span>
              <Input
                value={restockNote}
                onChange={e => setRestockNote(e.target.value)}
                placeholder="เช่น ซื้อจากตลาด"
                maxLength={200}
              />
            </div>
            <Button
              type="primary"
              disabled={!restockItemId || !restockQty || restockQty < 1}
              onClick={handleRestock}
              style={{ alignSelf: 'flex-end' }}
            >
              เพิ่มสต็อก
            </Button>
          </div>

          {/* Restock history */}
          <div className="store-restock-list">
            {restocks.length === 0 && (
              <p style={{ padding: '24px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                ยังไม่มีประวัติการเติมสต็อก
              </p>
            )}
            {restocks.map(r => (
              <div className="store-restock-row" key={r.id}>
                <ItemImg src={apiData?.stockImages[r.item_id]} name={r.item_name} size={32} />
                <div className="store-restock-row__meta">
                  <div style={{ fontWeight: 600 }}>{r.item_name}</div>
                  <div className="store-restock-row__time">
                    {new Date(r.restocked_at).toLocaleString('th-TH')}
                  </div>
                  {r.note && <div className="store-restock-row__note">{r.note}</div>}
                </div>
                <div style={{ fontWeight: 700, color: '#16a34a', whiteSpace: 'nowrap', fontSize: 14 }}>
                  +{r.qty.toLocaleString('th-TH')} ชิ้น
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tab 3: บันทึกการขาย ── */}
      {tab === 'sales' && (
        <div className="store-tab-content" style={{ padding: '0 16px 24px' }}>
          <div className="store-revenue-stat">
            ยอดขายรวม
            <span>{totalRevenue.toLocaleString('th-TH')} บาท</span>
          </div>
          <Table<SaleRecord>
            dataSource={sales}
            columns={salesColumns}
            rowKey="id"
            pagination={{ pageSize: 20 }}
            size="small"
            scroll={{ x: 600 }}
          />
        </div>
      )}
    </div>
  );
}

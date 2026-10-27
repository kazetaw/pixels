import { useEffect, useRef, useState } from 'react';
import { Button, Input, InputNumber, Modal, Select, Table, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { fetchAllData } from '../../api/client';
import type { AppData } from '../../types';

// ── Types ────────────────────────────────────────────────────────────────────

type StoreRow = { id: string; name: string };
type StoreProduct = { item_id: string; name: string; image_url: string | null; price: number; stock: number };
type RestockRecord = { id: string; item_id: string; item_name: string; image_url: string | null; qty: number; note: string; restocked_at: string };
type SaleRecord = { id: string; item_id: string; item_name: string; image_url: string | null; qty: number; price_per_unit: number; total: number; note: string; sold_at: string };

// ── Item image helper ──────────────────────────────────────────────────────

function ItemImg({ src, name, size = 40 }: { src?: string | null; name: string; size?: number }) {
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

// ── PIN input (4 individual digits, auto-advance, auto-submit) ────────────────

const PIN_LENGTH = 4;

function PinDots({
  onSubmit,
  error,
  onClear,
}: {
  onSubmit: (pin: string) => void;
  error: boolean;
  onClear: () => void;
}) {
  const [digits, setDigits] = useState<string[]>(['', '', '', '']);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  // Clear digits when error is signalled
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setDigits(['', '', '', '']);
        onClear();
        refs.current[0]?.focus();
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [error, onClear]);

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  const handleDigit = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);

    if (digit && index < PIN_LENGTH - 1) {
      refs.current[index + 1]?.focus();
    }

    if (digit && index === PIN_LENGTH - 1) {
      onSubmit(next.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  return (
    <div className="store-pin-dots" style={{ justifyContent: 'center' }}>
      {digits.map((d, i) => (
        <div key={i} style={{ position: 'relative', width: 52, height: 52 }}>
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
          <input
            ref={el => { refs.current[i] = el; }}
            type="password"
            inputMode="numeric"
            maxLength={1}
            value={d}
            onChange={e => handleDigit(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
            style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'text' }}
            aria-label={`PIN หลักที่ ${i + 1}`}
          />
        </div>
      ))}
    </div>
  );
}

// ── Store selector / creator ──────────────────────────────────────────────────

function StoreGate({ onEntered }: { onEntered: (storeId: string, storeName: string) => void }) {
  const [stores, setStores] = useState<StoreRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  // Create store form
  const [newName, setNewName] = useState('');
  const [newPin, setNewPin] = useState('');
  const [creating, setCreating] = useState(false);

  // PIN verification
  const [selectedStoreId, setSelectedStoreId] = useState<string | undefined>();
  const [pinError, setPinError] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    fetch('/api/store/list')
      .then(r => r.json())
      .then((data: StoreRow[]) => { setStores(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!newName.trim() || !/^\d{4}$/.test(newPin)) return;
    setCreating(true);
    try {
      const res = await fetch('/api/store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), pin: newPin }),
      });
      if (!res.ok) {
        const err = await res.json();
        void message.error(err.error ?? 'สร้างร้านไม่สำเร็จ');
        return;
      }
      const store: StoreRow = await res.json();
      // Auto-enter the newly-created store (no PIN re-entry needed)
      onEntered(store.id, store.name);
    } catch {
      void message.error('สร้างร้านไม่สำเร็จ');
    } finally {
      setCreating(false);
    }
  };

  const handlePinSubmit = async (pin: string) => {
    if (!selectedStoreId || verifying) return;
    setVerifying(true);
    try {
      const res = await fetch('/api/store/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: selectedStoreId, pin }),
      });
      if (!res.ok) {
        setPinError(true);
        return;
      }
      const storeName = stores?.find(s => s.id === selectedStoreId)?.name ?? '';
      onEntered(selectedStoreId, storeName);
    } catch {
      setPinError(true);
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="store-pin-gate">
        <div style={{ color: '#64748b', fontSize: 13 }}>กำลังโหลด...</div>
      </div>
    );
  }

  // No stores yet — show create form
  if (stores && stores.length === 0) {
    return (
      <div className="store-pin-gate">
        <div style={{ background: '#fff', borderRadius: 16, padding: '40px 32px', boxShadow: '0 4px 24px rgba(0,0,0,.08)', textAlign: 'center', minWidth: 300 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 22 }}>🏪</div>
          <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, color: '#0f172a' }}>สร้างร้านใหม่</h2>
          <p style={{ margin: '0 0 24px', fontSize: 13, color: '#64748b' }}>ยังไม่มีร้าน กรุณาสร้างร้านแรก</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'left' }}>
            <label>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>ชื่อร้าน</span>
              <Input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="เช่น ร้านค้าหลัก"
                maxLength={100}
              />
            </label>
            <label>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>PIN (4 หลัก)</span>
              <Input.Password
                value={newPin}
                onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="0000"
                inputMode="numeric"
                maxLength={4}
              />
            </label>
            <Button
              type="primary"
              loading={creating}
              disabled={!newName.trim() || newPin.length !== 4}
              onClick={() => void handleCreate()}
              style={{ marginTop: 4 }}
            >
              สร้างร้าน
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Stores exist — show selector then PIN entry
  return (
    <div className="store-pin-gate">
      <div style={{ background: '#fff', borderRadius: 16, padding: '40px 32px', boxShadow: '0 4px 24px rgba(0,0,0,.08)', textAlign: 'center', minWidth: 300 }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 22 }}>🔑</div>
        <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, color: '#0f172a' }}>ร้านค้า</h2>
        <p style={{ margin: '0 0 24px', fontSize: 13, color: '#64748b' }}>เลือกร้านและกรอก PIN เพื่อเข้าใช้งาน</p>

        <div style={{ marginBottom: 20, textAlign: 'left' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>ร้านค้า</span>
          <Select
            style={{ width: '100%' }}
            placeholder="เลือกร้าน"
            value={selectedStoreId}
            onChange={v => { setSelectedStoreId(v); setPinError(false); }}
            options={(stores ?? []).map(s => ({ value: s.id, label: s.name }))}
          />
        </div>

        {selectedStoreId && (
          <>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b' }}>กรอก PIN เพื่อเข้าร้าน</p>
            <PinDots
              onSubmit={handlePinSubmit}
              error={pinError}
              onClear={() => setPinError(false)}
            />
            {pinError && (
              <p style={{ margin: '12px 0 0', fontSize: 13, color: '#ef4444' }}>PIN ไม่ถูกต้อง</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Add Product Modal ─────────────────────────────────────────────────────────

function AddProductModal({
  open,
  storeId,
  existingItemIds,
  apiData,
  onClose,
  onAdded,
}: {
  open: boolean;
  storeId: string;
  existingItemIds: Set<string>;
  apiData: AppData | null;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [itemId, setItemId] = useState<string | undefined>();
  const [price, setPrice] = useState<number | null>(0);
  const [saving, setSaving] = useState(false);

  const itemOptions = Object.entries(apiData?.itemNames ?? {})
    .filter(([id]) => !existingItemIds.has(id))
    .map(([id, name]) => ({ value: id, label: name }));

  const handleOk = async () => {
    if (!itemId || price === null || price < 0) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/store/${storeId}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId, price }),
      });
      if (!res.ok) {
        const err = await res.json();
        void message.error(err.error ?? 'เพิ่มสินค้าไม่สำเร็จ');
        return;
      }
      setItemId(undefined);
      setPrice(0);
      onAdded();
    } catch {
      void message.error('เพิ่มสินค้าไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="เพิ่มสินค้าในร้าน"
      okText="เพิ่มสินค้า"
      cancelText="ยกเลิก"
      onOk={() => void handleOk()}
      onCancel={onClose}
      confirmLoading={saving}
      okButtonProps={{ disabled: !itemId || price === null || price < 0 }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '8px 0' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>สินค้า</span>
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="ค้นหาและเลือกสินค้า"
            value={itemId}
            onChange={setItemId}
            options={itemOptions}
            style={{ width: '100%' }}
          />
        </label>
        {itemId && apiData?.stockImages[itemId] && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ItemImg src={apiData.stockImages[itemId]} name={apiData.itemNames[itemId] ?? ''} size={40} />
            <span style={{ fontSize: 13, color: '#374151' }}>{apiData.itemNames[itemId]}</span>
          </div>
        )}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>ราคา (฿)</span>
          <InputNumber
            min={0}
            precision={2}
            value={price}
            onChange={v => setPrice(v)}
            addonBefore="฿"
            style={{ width: '100%' }}
            placeholder="0.00"
          />
        </label>
      </div>
    </Modal>
  );
}

// ── Sell Modal ─────────────────────────────────────────────────────────────────

function SellModal({
  product,
  storeId,
  apiData,
  onClose,
  onSold,
}: {
  product: StoreProduct | null;
  storeId: string;
  apiData: AppData | null;
  onClose: () => void;
  onSold: () => void;
}) {
  const [qty, setQty] = useState<number | null>(1);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (product) { setQty(1); setNote(''); }
  }, [product?.item_id]);

  const handleSell = async () => {
    if (!product || !qty || qty < 1) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/store/${storeId}/sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: product.item_id, qty, note }),
      });
      if (!res.ok) {
        const err = await res.json();
        void message.error(err.error ?? 'บันทึกการขายไม่สำเร็จ');
        return;
      }
      onSold();
    } catch {
      void message.error('บันทึกการขายไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const total = product && qty ? product.price * qty : 0;

  return (
    <Modal
      open={!!product}
      title={product?.name ?? ''}
      okText="ยืนยันการขาย"
      cancelText="ยกเลิก"
      onOk={() => void handleSell()}
      onCancel={onClose}
      confirmLoading={saving}
      okButtonProps={{ disabled: !qty || qty < 1 }}
    >
      {product && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '8px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ItemImg src={product.image_url ?? apiData?.stockImages[product.item_id]} name={product.name} size={40} />
            <div>
              <div style={{ fontSize: 13, color: '#64748b' }}>
                สต็อกคงเหลือ: <strong style={{ color: '#0f172a' }}>{product.stock.toLocaleString('th-TH')} ชิ้น</strong>
              </div>
              <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
                ราคา/ชิ้น: <strong style={{ color: '#4f46e5' }}>฿{new Intl.NumberFormat('th-TH').format(product.price)}</strong>
              </div>
            </div>
          </div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>จำนวนที่ขาย</span>
            <InputNumber
              autoFocus
              min={1}
              max={product.stock}
              precision={0}
              value={qty}
              onChange={setQty}
              style={{ width: '100%' }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>หมายเหตุ (ไม่บังคับ)</span>
            <Input
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="เช่น ลูกค้า VIP"
              maxLength={200}
            />
          </label>
          {qty && qty > 0 && (
            <div style={{ padding: '10px 14px', background: '#eef2ff', borderRadius: 8, fontSize: 14, fontWeight: 600, color: '#4f46e5' }}>
              รวม ฿{new Intl.NumberFormat('th-TH').format(total)}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

// ── Main StorePage ─────────────────────────────────────────────────────────────

export function StorePage() {
  // Store session (not persisted — PIN required on each load)
  const [session, setSession] = useState<{ storeId: string; storeName: string } | null>(null);

  const [tab, setTab] = useState<'overview' | 'restock' | 'sales'>('overview');
  const [apiData, setApiData] = useState<AppData | null>(null);

  // Store data
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [restocks, setRestocks] = useState<RestockRecord[]>([]);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Sell modal
  const [sellProduct, setSellProduct] = useState<StoreProduct | null>(null);

  // Add product modal
  const [addOpen, setAddOpen] = useState(false);

  // Restock form
  const [restockItemId, setRestockItemId] = useState<string | undefined>();
  const [restockQty, setRestockQty] = useState<number | null>(1);
  const [restockNote, setRestockNote] = useState('');
  const [restocking, setRestocking] = useState(false);

  // Load API data (items catalog) once we have a session
  useEffect(() => {
    if (!session) return;
    fetchAllData().then(data => setApiData(data)).catch(() => { /* silent */ });
  }, [session?.storeId]);

  // Fetch all store data
  const fetchAll = async (storeId: string) => {
    setLoadingProducts(true);
    try {
      const [pRes, rRes, sRes] = await Promise.all([
        fetch(`/api/store/${storeId}/products`),
        fetch(`/api/store/${storeId}/restocks`),
        fetch(`/api/store/${storeId}/sales`),
      ]);
      if (pRes.ok) setProducts(await pRes.json());
      if (rRes.ok) setRestocks(await rRes.json());
      if (sRes.ok) setSales(await sRes.json());
    } catch {
      void message.error('โหลดข้อมูลร้านไม่สำเร็จ');
    } finally {
      setLoadingProducts(false);
    }
  };

  useEffect(() => {
    if (session) void fetchAll(session.storeId);
  }, [session?.storeId]);

  // ── Summary stats ────────────────────────────────────────────────────────────

  const totalItems = products.length;
  const totalStock = products.reduce((s, p) => s + p.stock, 0);
  const totalRevenue = sales.reduce((s, r) => s + Number(r.total), 0);
  const totalUnitsSold = sales.reduce((s, r) => s + r.qty, 0);

  // ── Price update (inline) ────────────────────────────────────────────────────

  const handlePriceBlur = async (product: StoreProduct, newPrice: number | null) => {
    if (newPrice === null || newPrice < 0 || newPrice === product.price) return;
    if (!session) return;
    try {
      const res = await fetch(`/api/store/${session.storeId}/products/${product.item_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price: newPrice }),
      });
      if (!res.ok) {
        const err = await res.json();
        void message.error(err.error ?? 'อัปเดตราคาไม่สำเร็จ');
        return;
      }
      setProducts(prev => prev.map(p => p.item_id === product.item_id ? { ...p, price: newPrice } : p));
    } catch {
      void message.error('อัปเดตราคาไม่สำเร็จ');
    }
  };

  // ── Restock ──────────────────────────────────────────────────────────────────

  const handleRestock = async () => {
    if (!session || !restockItemId || !restockQty || restockQty < 1) return;
    setRestocking(true);
    try {
      const res = await fetch(`/api/store/${session.storeId}/restock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: restockItemId, qty: restockQty, note: restockNote.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        void message.error(err.error ?? 'เติมสต็อกไม่สำเร็จ');
        return;
      }
      setRestockItemId(undefined);
      setRestockQty(1);
      setRestockNote('');
      void fetchAll(session.storeId);
    } catch {
      void message.error('เติมสต็อกไม่สำเร็จ');
    } finally {
      setRestocking(false);
    }
  };

  // ── Delete sale ───────────────────────────────────────────────────────────────

  const handleDeleteSale = async (saleId: string) => {
    if (!session) return;
    try {
      const res = await fetch(`/api/store/${session.storeId}/sales/${saleId}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        void message.error(err.error ?? 'ลบรายการขายไม่สำเร็จ');
        return;
      }
      setSales(prev => prev.filter(s => s.id !== saleId));
    } catch {
      void message.error('ลบรายการขายไม่สำเร็จ');
    }
  };

  // ── Remove product ────────────────────────────────────────────────────────────

  const handleRemoveProduct = async (itemId: string) => {
    if (!session) return;
    try {
      const res = await fetch(`/api/store/${session.storeId}/products/${itemId}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        void message.error(err.error ?? 'ลบสินค้าไม่สำเร็จ');
        return;
      }
      setProducts(prev => prev.filter(p => p.item_id !== itemId));
    } catch {
      void message.error('ลบสินค้าไม่สำเร็จ');
    }
  };

  // ── Sales table columns ───────────────────────────────────────────────────────

  const salesColumns: ColumnsType<SaleRecord> = [
    {
      title: 'วันที่/เวลา',
      dataIndex: 'sold_at',
      key: 'sold_at',
      width: 150,
      render: (v: string) => new Date(v).toLocaleString('th-TH'),
    },
    {
      title: 'สินค้า',
      key: 'item',
      render: (_: unknown, r: SaleRecord) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ItemImg src={r.image_url} name={r.item_name} size={28} />
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
      width: 110,
      align: 'right' as const,
      render: (v: number) => `฿${new Intl.NumberFormat('th-TH').format(v)}`,
    },
    {
      title: 'รวม',
      dataIndex: 'total',
      key: 'total',
      width: 110,
      align: 'right' as const,
      render: (v: number) => `฿${new Intl.NumberFormat('th-TH').format(v)}`,
    },
    {
      title: 'หมายเหตุ',
      dataIndex: 'note',
      key: 'note',
      render: (v: string) => v || '—',
    },
    {
      title: '',
      key: 'delete',
      width: 60,
      align: 'center' as const,
      render: (_: unknown, r: SaleRecord) => (
        <Button danger size="small" onClick={() => void handleDeleteSale(r.id)}>ลบ</Button>
      ),
    },
  ];

  // ── Guard: show store gate if no session ──────────────────────────────────────

  if (!session) {
    return (
      <StoreGate
        onEntered={(storeId, storeName) => setSession({ storeId, storeName })}
      />
    );
  }

  // ── Items for restock dropdown (only products already in the store) ───────────

  const productItemOptions = products.map(p => ({
    value: p.item_id,
    label: p.name || p.item_id,
  }));

  const existingItemIds = new Set(products.map(p => p.item_id));

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="store-page">
      {/* Top navbar */}
      <nav className="store-navbar" aria-label="ร้านค้า">
        <span className="store-navbar__title">{session.storeName}</span>
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
        <button
          onClick={() => setSession(null)}
          style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 6, color: '#fff', padding: '5px 10px', cursor: 'pointer', fontSize: 12 }}
        >
          ออกจากร้าน
        </button>
      </nav>

      {/* ── Tab 1: ภาพรวม ── */}
      {tab === 'overview' && (
        <div className="store-tab-content">
          {/* Summary cards */}
          <div className="store-summary-row">
            <div className="store-summary-card">
              <div className="store-summary-card__value">{totalItems.toLocaleString('th-TH')}</div>
              <div className="store-summary-card__label">สินค้า (รายการ)</div>
            </div>
            <div className="store-summary-card">
              <div className="store-summary-card__value">{totalStock.toLocaleString('th-TH')}</div>
              <div className="store-summary-card__label">สต็อกรวม (ชิ้น)</div>
            </div>
            <div className="store-summary-card">
              <div className="store-summary-card__value">฿{new Intl.NumberFormat('th-TH').format(totalRevenue)}</div>
              <div className="store-summary-card__label">ยอดขายรวม</div>
            </div>
          </div>

          {/* Add product button */}
          <div style={{ padding: '0 16px 12px', display: 'flex', justifyContent: 'flex-end' }}>
            <Button type="primary" onClick={() => setAddOpen(true)}>
              เพิ่มสินค้า
            </Button>
          </div>

          {/* Product grid */}
          {loadingProducts ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>กำลังโหลด...</div>
          ) : products.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 16px', color: '#94a3b8', fontSize: 13 }}>
              ยังไม่มีสินค้าในร้าน — กดปุ่ม "เพิ่มสินค้า" เพื่อเริ่ม
            </div>
          ) : (
            <div className="store-product-grid">
              {products.map(p => {
                const imgSrc = p.image_url ?? apiData?.stockImages[p.item_id];
                return (
                  <div className="store-product-card" key={p.item_id}>
                    <ItemImg src={imgSrc} name={p.name} size={56} />
                    <div className="store-product-card__name">{p.name}</div>
                    <div className={`store-product-card__qty${p.stock <= 0 ? ' is-empty' : ''}`}>
                      {p.stock <= 0 ? 'หมด' : `${p.stock.toLocaleString('th-TH')} ชิ้น`}
                    </div>
                    <InlinePriceInput
                      product={p}
                      onBlur={handlePriceBlur}
                    />
                    <Button
                      type="primary"
                      size="small"
                      disabled={p.stock <= 0}
                      onClick={() => setSellProduct(p)}
                      style={{ width: '100%' }}
                    >
                      ขายไป
                    </Button>
                    <Button
                      danger
                      size="small"
                      onClick={() => void handleRemoveProduct(p.item_id)}
                      style={{ width: '100%' }}
                    >
                      ลบออกจากร้าน
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Sell modal */}
          <SellModal
            product={sellProduct}
            storeId={session.storeId}
            apiData={apiData}
            onClose={() => setSellProduct(null)}
            onSold={() => {
              setSellProduct(null);
              void fetchAll(session.storeId);
            }}
          />

          {/* Add product modal */}
          <AddProductModal
            open={addOpen}
            storeId={session.storeId}
            existingItemIds={existingItemIds}
            apiData={apiData}
            onClose={() => setAddOpen(false)}
            onAdded={() => {
              setAddOpen(false);
              void fetchAll(session.storeId);
            }}
          />
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
                options={productItemOptions}
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
              loading={restocking}
              disabled={!restockItemId || !restockQty || restockQty < 1}
              onClick={() => void handleRestock()}
              style={{ alignSelf: 'flex-end' }}
            >
              เพิ่มสต็อก
            </Button>
          </div>

          {/* Restock history */}
          <div className="store-restock-list">
            {restocks.length === 0 ? (
              <p style={{ padding: '24px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                ยังไม่มีประวัติการเติมสต็อก
              </p>
            ) : restocks.map(r => (
              <div className="store-restock-row" key={r.id}>
                <ItemImg src={r.image_url} name={r.item_name} size={32} />
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
            <span>ยอดขายรวม</span>
            <span style={{ color: '#4f46e5', fontSize: 20, marginLeft: 8 }}>
              ฿{new Intl.NumberFormat('th-TH').format(totalRevenue)} บาท
            </span>
            <span style={{ color: '#64748b', fontSize: 13, marginLeft: 12 }}>
              ({totalUnitsSold.toLocaleString('th-TH')} ชิ้น)
            </span>
          </div>
          <Table<SaleRecord>
            dataSource={sales}
            columns={salesColumns}
            rowKey="id"
            pagination={{ pageSize: 20 }}
            size="small"
            scroll={{ x: 700 }}
          />
        </div>
      )}
    </div>
  );
}

// ── Inline price input (isolated state to avoid re-render churn) ───────────────

function InlinePriceInput({
  product,
  onBlur,
}: {
  product: StoreProduct;
  onBlur: (product: StoreProduct, newPrice: number | null) => Promise<void>;
}) {
  const [value, setValue] = useState<number | null>(product.price);

  // Sync when product price changes from outside
  useEffect(() => {
    setValue(product.price);
  }, [product.price]);

  return (
    <InputNumber
      min={0}
      precision={2}
      value={value}
      onChange={setValue}
      onBlur={() => void onBlur(product, value)}
      placeholder="ราคา"
      addonBefore="฿"
      size="small"
      style={{ width: '100%' }}
      aria-label={`ราคา ${product.name}`}
    />
  );
}

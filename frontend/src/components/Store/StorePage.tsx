import { useEffect, useRef, useState, useMemo } from 'react';
import {
  Alert, Badge, Button, Card, Empty, Input, InputNumber,
  Modal, Popconfirm, Select, Spin, Statistic, Table, Tag, message,
} from 'antd';
import {
  DeleteOutlined, LogoutOutlined, MinusCircleOutlined,
  PlusOutlined, SearchOutlined, ShopOutlined, ShoppingCartOutlined, ReloadOutlined, SettingOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { fetchAllData } from '../../api/client';
import type { AppData } from '../../types';
import './StorePage.css';

// ── Types ─────────────────────────────────────────────────────────────────────
type StoreRow = { id: string; name: string };
type StoreProduct = { item_id: string; name: string; image_url: string | null; price: number; stock: number };
type SaleRecord = { id: string; item_id: string; item_name: string; image_url: string | null; qty: number; price_per_unit: number; total: number; note: string; sold_at: string };

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number) { return n.toLocaleString('th-TH'); }
function fmtMoney(n: number) { return `฿${new Intl.NumberFormat('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n)}`; }

function ItemImg({ src, name, size = 40 }: { src?: string | null; name: string; size?: number }) {
  return src
    ? <img src={src} alt={name} style={{ width: size, height: size, objectFit: 'contain', borderRadius: 6, background: '#f1f5f9', flexShrink: 0 }} />
    : <div style={{ width: size, height: size, borderRadius: 6, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.4, color: '#cbd5e1', flexShrink: 0 }}>📦</div>;
}

// ── PIN Gate ──────────────────────────────────────────────────────────────────
function PinDots({ onSubmit, error, onClear }: { onSubmit: (pin: string) => void; error: boolean; onClear: () => void }) {
  const [digits, setDigits] = useState(['', '', '', '']);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  useEffect(() => { if (error) { setTimeout(() => { setDigits(['', '', '', '']); onClear(); refs.current[0]?.focus(); }, 600); } }, [error, onClear]);
  useEffect(() => { refs.current[0]?.focus(); }, []);
  const handleDigit = (i: number, v: string) => {
    const d = v.replace(/\D/g, '').slice(-1);
    const next = [...digits]; next[i] = d; setDigits(next);
    if (d && i < 3) refs.current[i + 1]?.focus();
    if (d && i === 3) onSubmit(next.join(''));
  };
  return (
    <div style={{ display: 'flex', gap: 12, justifyContent: 'center', margin: '8px 0' }}>
      {digits.map((d, i) => (
        <div key={i} style={{ position: 'relative', width: 48, height: 48 }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `2px solid ${error ? '#ef4444' : d ? '#2563eb' : '#e2e8f0'}`, background: error ? '#fef2f2' : d ? '#eff6ff' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'border-color .15s' }}>
            {d && <div style={{ width: 12, height: 12, borderRadius: '50%', background: error ? '#ef4444' : '#2563eb' }} />}
          </div>
          <input ref={el => { refs.current[i] = el; }} type="password" inputMode="numeric" maxLength={1} value={d} onChange={e => handleDigit(i, e.target.value)} onKeyDown={e => { if (e.key === 'Backspace' && !d && i > 0) refs.current[i - 1]?.focus(); }} style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'text' }} />
        </div>
      ))}
    </div>
  );
}

function StoreGate({ onEntered }: { onEntered: (id: string, name: string) => void }) {
  const [stores, setStores] = useState<StoreRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newPin, setNewPin] = useState('');
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string>();
  const [pinError, setPinError] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    fetch('/api/store/list').then(r => r.json()).then((d: StoreRow[]) => { setStores(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!newName.trim() || newPin.length !== 4) return;
    setCreating(true);
    try {
      const res = await fetch('/api/store', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newName.trim(), pin: newPin }) });
      const data = await res.json();
      if (!res.ok) { void message.error(data.error ?? 'สร้างร้านไม่สำเร็จ'); return; }
      onEntered(data.id, data.name);
    } catch { void message.error('สร้างร้านไม่สำเร็จ'); }
    finally { setCreating(false); }
  };

  const handlePin = async (pin: string) => {
    if (!selectedId || verifying) return;
    setVerifying(true);
    try {
      const res = await fetch('/api/store/verify-pin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ store_id: selectedId, pin }) });
      if (!res.ok) { setPinError(true); return; }
      onEntered(selectedId, stores?.find(s => s.id === selectedId)?.name ?? '');
    } catch { setPinError(true); }
    finally { setVerifying(false); }
  };

  if (loading) return <div className="store-gate"><Spin /></div>;

  return (
    <div className="store-gate">
      <div className="store-gate-card">
        <div className="store-gate-icon"><ShopOutlined style={{ fontSize: 28, color: '#2563eb' }} /></div>
        <h2 className="store-gate-title">{stores?.length === 0 ? 'สร้างร้านใหม่' : 'เข้าร้านค้า'}</h2>

        {stores?.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
            <div><div className="store-field-label">ชื่อร้าน</div><Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="เช่น ร้านค้าหลัก" maxLength={100} /></div>
            <div><div className="store-field-label">PIN (4 หลัก)</div><Input.Password value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="0000" inputMode="numeric" maxLength={4} /></div>
            <Button type="primary" block loading={creating} disabled={!newName.trim() || newPin.length !== 4} onClick={() => void handleCreate()}>สร้างร้าน</Button>
          </div>
        ) : (
          <>
            <div style={{ width: '100%', marginBottom: 20 }}>
              <div className="store-field-label">เลือกร้าน</div>
              <Select style={{ width: '100%' }} placeholder="เลือกร้าน" value={selectedId} onChange={v => { setSelectedId(v); setPinError(false); }} options={(stores ?? []).map(s => ({ value: s.id, label: s.name }))} />
            </div>
            {selectedId && (
              <>
                <div className="store-field-label" style={{ marginBottom: 8 }}>กรอก PIN</div>
                <PinDots onSubmit={handlePin} error={pinError} onClear={() => setPinError(false)} />
                {pinError && <Alert type="error" message="PIN ไม่ถูกต้อง" style={{ marginTop: 8 }} />}
                {verifying && <div style={{ marginTop: 8, color: '#64748b', fontSize: 12 }}>กำลังตรวจสอบ…</div>}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Sell Modal ────────────────────────────────────────────────────────────────
function SellModal({ product, storeId, imgSrc, onClose, onSold }: { product: StoreProduct | null; storeId: string; imgSrc?: string; onClose: () => void; onSold: () => void }) {
  const [qty, setQty] = useState<number | null>(1);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (product) { setQty(1); setNote(''); } }, [product?.item_id]);

  const handleSell = async () => {
    if (!product || !qty || !Number.isSafeInteger(qty) || qty < 1 || qty > product.stock || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/store/${storeId}/sales`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item_id: product.item_id, qty, note }) });
      if (!res.ok) { const e = await res.json(); void message.error(e.error ?? 'บันทึกการขายไม่สำเร็จ'); return; }
      void message.success(`ขาย ${product.name} ${qty} ชิ้น`);
      onSold();
    } catch { void message.error('บันทึกการขายไม่สำเร็จ'); }
    finally { setSaving(false); }
  };

  return (
    <Modal open={!!product} title="บันทึกการขาย" okText="ยืนยันขาย" cancelText="ยกเลิก" onOk={() => void handleSell()} onCancel={() => { if (!saving) onClose(); }} closable={!saving} maskClosable={!saving} confirmLoading={saving} okButtonProps={{ disabled: !qty || !Number.isSafeInteger(qty) || qty < 1 || qty > (product?.stock ?? 0), type: 'primary' }}>
      {product && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '8px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <ItemImg src={imgSrc} name={product.name} size={48} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>{product.name}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>สต็อก {fmt(product.stock)} ชิ้น · ราคา {fmtMoney(product.price)}/ชิ้น</div>
            </div>
          </div>
          <div className="store-sale-stock">หลังขายจะเหลือ <b>{fmt(Math.max(0, product.stock - (qty ?? 0)))}</b> ชิ้น</div><div><div className="store-field-label">จำนวนที่ขาย</div><Input autoFocus aria-label="จำนวนที่ขาย" type="number" min={1} max={product.stock} step={1} value={qty ?? ''} onChange={e => setQty(e.target.value === '' ? null : Number(e.target.value))} size="large" /></div>
          <div><div className="store-field-label">หมายเหตุ (ไม่บังคับ)</div><Input value={note} onChange={e => setNote(e.target.value)} placeholder="เช่น ลูกค้า VIP" maxLength={200} /></div>
          {qty && qty > 0 && <div style={{ padding: '10px 14px', background: '#eff6ff', borderRadius: 8, fontSize: 15, fontWeight: 700, color: '#2563eb', textAlign: 'center' }}>รวม {fmtMoney(product.price * qty)}</div>}
        </div>
      )}
    </Modal>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function StorePage() {
  const [session, setSession] = useState<{ storeId: string; storeName: string } | null>(null);
  const [tab, setTab] = useState<'overview' | 'restock' | 'sales'>('overview');
  const [apiData, setApiData] = useState<AppData | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [sellProduct, setSellProduct] = useState<StoreProduct | null>(null);
  const [msgApi, ctx] = message.useMessage();

  // Bulk restock state
  const [restockSearch, setRestockSearch] = useState('');
  const [restockQtys, setRestockQtys] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  // Overview search
  const [overviewSearch, setOverviewSearch] = useState('');
  const [stockFilter, setStockFilter] = useState('all');
  const [editing, setEditing] = useState<StoreProduct | 'new' | null>(null);
  const [editId, setEditId] = useState<string>();
  const [editPrice, setEditPrice] = useState<number | null>(0);
  const [editStock, setEditStock] = useState<number | null>(0);
  const [savingProduct, setSavingProduct] = useState(false);
  const [deletingSale, setDeletingSale] = useState<string | null>(null);
  const [loadError, setLoadError] = useState('');
  const openEditor = (product: StoreProduct | 'new') => {
    setEditing(product); setEditId(product === 'new' ? undefined : product.item_id);
    setEditPrice(product === 'new' ? 0 : product.price); setEditStock(product === 'new' ? 0 : product.stock);
  };
  const validEdit = !!editId && editPrice !== null && Number.isFinite(editPrice) && editPrice >= 0 && editStock !== null && Number.isSafeInteger(editStock) && editStock >= 0;
  const saveProduct = async () => {
    if (!session || !editing || !validEdit || savingProduct) return;
    setSavingProduct(true);
    try {
      const res = await fetch(`/api/store/${session.storeId}/products${editing === 'new' ? '' : '/' + encodeURIComponent(editId!)}`, {
        method: editing === 'new' ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing === 'new' ? { item_id: editId, price: editPrice } : { price: editPrice, stock: editStock }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'บันทึกสินค้าไม่สำเร็จ');
      setEditing(null); void msgApi.success('บันทึกสินค้าแล้ว'); await fetchAll(session.storeId);
    } catch (e) { void msgApi.error(e instanceof Error ? e.message : 'เชื่อมต่อไม่สำเร็จ ลองอีกครั้ง'); }
    finally { setSavingProduct(false); }
  };
  const deleteProduct = async () => {
    if (!session || !editing || editing === 'new' || savingProduct) return;
    setSavingProduct(true);
    try {
      const res = await fetch(`/api/store/${session.storeId}/products/${encodeURIComponent(editing.item_id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('ลบสินค้าไม่สำเร็จ');
      setRestockQtys(prev => { const next = { ...prev }; delete next[editing.item_id]; return next; });
      setEditing(null); void msgApi.success('นำสินค้าออกจากร้านแล้ว'); await fetchAll(session.storeId);
    } catch { void msgApi.error('ลบสินค้าไม่สำเร็จ กรุณาลองอีกครั้ง'); }
    finally { setSavingProduct(false); }
  };

  useEffect(() => {
    if (!session) return;
    fetchAllData().then(setApiData).catch(() => {});
  }, [session?.storeId]);

  const fetchAll = async (storeId: string) => {
    setLoading(true); setLoadError('');
    try {
      const [pRes, sRes] = await Promise.all([fetch(`/api/store/${storeId}/products`), fetch(`/api/store/${storeId}/sales`)]);
      if (!pRes.ok || !sRes.ok) throw new Error('โหลดไม่สำเร็จ');
      setProducts(await pRes.json()); setSales(await sRes.json());
    } catch { setLoadError('โหลดข้อมูลร้านไม่สำเร็จ กรุณากดรีเฟรช'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (session) void fetchAll(session.storeId); }, [session?.storeId]);

  const getImg = (p: StoreProduct) => p.image_url ?? apiData?.stockImages[p.item_id];

  // Stats
  const totalStock = products.reduce((s, p) => s + p.stock, 0);
  const totalRevenue = sales.reduce((s, r) => s + Number(r.total), 0);
  const outOfStock = products.filter(p => p.stock === 0).length;

  // Bulk restock submit
  const handleBulkRestock = async () => {
    if (!session || submitting) return;
    const entries = Object.entries(restockQtys).filter(([, q]) => Number.isSafeInteger(q) && q > 0);
    if (!entries.length) return;
    setSubmitting(true);
    let success = 0;
    for (const [item_id, qty] of entries) {
      try {
        const res = await fetch(`/api/store/${session.storeId}/restock`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item_id, qty }) });
        if (res.ok) { success++; setRestockQtys(prev => { const next = { ...prev }; delete next[item_id]; return next; }); }
      } catch { /* continue */ }
    }
    setSubmitting(false);
    await fetchAll(session.storeId);
    if (success) void msgApi.success(`เติมสต็อก ${success} รายการแล้ว`);
    if (success < entries.length) void msgApi.error(`ยังไม่สำเร็จ ${entries.length - success} รายการ เก็บจำนวนไว้ให้กดลองอีกครั้ง`);
  };

  const pendingCount = Object.values(restockQtys).filter(q => q > 0).length;

  // Filtered products
  const filteredOverview = useMemo(() => {
    const q = overviewSearch.toLowerCase().trim();
    return products.filter(p => (!q || p.name.toLowerCase().includes(q)) && (stockFilter === 'all' || (stockFilter === 'ready' ? p.stock > 0 : p.stock === 0)));
  }, [products, overviewSearch, stockFilter]);

  const filteredRestock = useMemo(() => {
    const q = restockSearch.toLowerCase().trim();
    return q ? products.filter(p => p.name.toLowerCase().includes(q)) : products;
  }, [products, restockSearch]);

  // Sales columns
  const salesColumns: ColumnsType<SaleRecord> = [
    { title: 'วันที่', dataIndex: 'sold_at', width: 140, render: (v: string) => new Date(v).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }) },
    { title: 'สินค้า', key: 'item', render: (_: unknown, r) => <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><ItemImg src={r.image_url} name={r.item_name} size={28} /><span>{r.item_name}</span></div> },
    { title: 'จำนวน', dataIndex: 'qty', align: 'right', width: 72, render: (v: number) => fmt(v) },
    { title: 'ราคา/ชิ้น', dataIndex: 'price_per_unit', align: 'right', width: 100, render: (v: number) => fmtMoney(v) },
    { title: 'รวม', dataIndex: 'total', align: 'right', width: 110, render: (v: number) => <span style={{ fontWeight: 700, color: '#2563eb' }}>{fmtMoney(Number(v))}</span> },
    { title: 'หมายเหตุ', dataIndex: 'note', render: (v: string) => v || '—' },
    { title: '', key: 'del', width: 80, render: (_: unknown, r) => <Popconfirm title="ลบประวัติการขายนี้?" description="ยอดขายรวมจะลดลง แต่จำนวนสินค้าในสต็อกจะไม่ถูกคืน" okText="ลบประวัติ" cancelText="เก็บไว้" onConfirm={async () => {
      if (deletingSale) return; setDeletingSale(r.id);
      try { const res = await fetch(`/api/store/${session!.storeId}/sales/${r.id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(); setSales(prev => prev.filter(s => s.id !== r.id)); void msgApi.success('ลบประวัติแล้ว');
      } catch { void msgApi.error('ลบประวัติไม่สำเร็จ กรุณาลองอีกครั้ง'); } finally { setDeletingSale(null); }
    }}><Button aria-label={`ลบประวัติขาย ${r.item_name}`} loading={deletingSale === r.id} disabled={!!deletingSale} size="small" danger type="text" icon={<DeleteOutlined />} /></Popconfirm> },
  ];

  if (!session) return <StoreGate onEntered={(id, name) => setSession({ storeId: id, storeName: name })} />;

  return (
    <div className="store-page">
      {ctx}
      {/* Navbar */}
      <nav className="store-navbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ShopOutlined style={{ fontSize: 18, color: '#fff' }} />
          <span className="store-navbar__title">{session.storeName}</span>
        </div>
        <div className="store-navbar__tabs">
          {([['overview', 'หน้าร้าน'], ['restock', 'เติมสต็อก'], ['sales', 'ประวัติขาย']] as const).map(([key, label]) => (
            <button key={key} className={`store-navbar__tab${tab === key ? ' is-active' : ''}`} onClick={() => setTab(key)}>
              {key === 'restock' && pendingCount > 0 ? <Badge count={pendingCount} offset={[4, -2]}><span>{label}</span></Badge> : label}
            </button>
          ))}
        </div>
        <Button size="small" icon={<LogoutOutlined />} onClick={() => { setSession(null); setProducts([]); setSales([]); setApiData(null); setRestockQtys({}); setTab('overview'); }} style={{ background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff' }}>ออก</Button>
      </nav>

      <div className="store-body">
        <header className="store-intro"><div><h1>{tab === 'overview' ? 'พร้อมขายอะไรดี?' : tab === 'restock' ? 'เติมของเข้าร้าน' : 'รายการขายของร้าน'}</h1><p>{tab === 'overview' ? 'เลือกสินค้า เช็กจำนวน แล้วบันทึกการขายได้เลย' : tab === 'restock' ? 'กรอกหลายรายการ แล้วบันทึกพร้อมกัน' : 'ดูยอดขาย จำนวน และหมายเหตุของแต่ละรายการ'}</p></div>
          <Button size="large" type="primary" icon={<PlusOutlined />} onClick={() => openEditor('new')}>เพิ่มสินค้าในร้าน</Button>
        </header>
        {loadError && <Alert type="error" showIcon message={loadError} action={<Button onClick={() => void fetchAll(session.storeId)}>ลองใหม่</Button>} />}

        {/* ── Overview ── */}
        {tab === 'overview' && (
          <>
            {/* Stats */}
            <div className="store-stats-row">
              <Card size="small" className="store-stat-card"><Statistic title="สินค้าทั้งหมด" value={products.length} suffix="รายการ" /></Card>
              <Card size="small" className="store-stat-card"><Statistic title="สต็อกรวม" value={totalStock} suffix="ชิ้น" /></Card>
              <Card size="small" className="store-stat-card"><Statistic title="ยอดขายรวม" value={totalRevenue} precision={0} prefix="฿" formatter={v => Number(v).toLocaleString('th-TH')} /></Card>
              {outOfStock > 0 && <Card size="small" className="store-stat-card store-stat-card--warn"><Statistic title="สินค้าหมด" value={outOfStock} suffix="รายการ" valueStyle={{ color: '#dc2626' }} /></Card>}
            </div>

            <div className="store-toolbar">
              <Input prefix={<SearchOutlined />} placeholder="ค้นหาสินค้า…" value={overviewSearch} onChange={e => setOverviewSearch(e.target.value)} allowClear style={{ flex: 1 }} />
              <Select aria-label="กรองตามสต็อก" value={stockFilter} onChange={setStockFilter} options={[{value:'all',label:`ทั้งหมด (${products.length})`},{value:'ready',label:`พร้อมขาย (${products.length-outOfStock})`},{value:'empty',label:`หมดสต็อก (${outOfStock})`}]} />
              <Button icon={<ReloadOutlined />} loading={loading} onClick={() => void fetchAll(session.storeId)}>รีเฟรช</Button>
            </div>
            {loading ? <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div> : filteredOverview.length === 0 ? <Empty description="ไม่พบสินค้า" /> : (
              <div className="store-product-grid">
                {filteredOverview.map(p => {
                  const img = getImg(p);
                  const empty = p.stock === 0;
                  return (
                    <div key={p.item_id} className={`store-product-card${empty ? ' is-empty' : ''}`}>
                      <ItemImg src={img} name={p.name} size={76} />
                      <div className="store-product-card__name">{p.name}</div>
                      <div className={`store-product-card__stock${empty ? ' is-out' : ''}`}>
                        {empty ? <Tag color="error">หมด</Tag> : <span>{fmt(p.stock)} ชิ้น</span>}
                      </div>
                      <div className="store-product-price">{fmtMoney(p.price)} <small>/ ชิ้น</small></div>
                      <div className="store-product-actions"><Button type="primary" disabled={empty} icon={<ShoppingCartOutlined />} onClick={() => setSellProduct(p)}>ขายสินค้า</Button>
                      <Button icon={<SettingOutlined />} aria-label={`จัดการ ${p.name}`} onClick={() => openEditor(p)} /></div>
                      <button className="store-restock-link" onClick={() => { setRestockSearch(p.name); setTab('restock'); }}>เติมสต็อก</button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── Bulk Restock ── */}
        {tab === 'restock' && (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
              <Input prefix={<SearchOutlined />} placeholder="ค้นหาสินค้า…" value={restockSearch} onChange={e => setRestockSearch(e.target.value)} allowClear style={{ flex: 1 }} />
              <Button type="primary" icon={<PlusOutlined />} disabled={pendingCount === 0} loading={submitting} onClick={() => void handleBulkRestock()}>
                เติมสต็อก {pendingCount > 0 ? `(${pendingCount} รายการ)` : ''}
              </Button>
              {pendingCount > 0 && <Button disabled={submitting} icon={<MinusCircleOutlined />} onClick={() => setRestockQtys({})}>ล้างที่กรอก</Button>}
            </div>

            <div className="store-restock-list">
              <div className="store-restock-list__head">
                <span>สินค้า</span><span>สต็อกปัจจุบัน</span><span>เพิ่ม (ชิ้น)</span>
              </div>
              {filteredRestock.length === 0 ? <Empty description="ไม่พบสินค้า" style={{ padding: 24 }} /> : filteredRestock.map(p => (
                <div key={p.item_id} className={`store-restock-row${(restockQtys[p.item_id] ?? 0) > 0 ? ' is-pending' : ''}`}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                    <ItemImg src={getImg(p)} name={p.name} size={28} />
                    <span style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                  </div>
                  <span style={{ fontSize: 13, color: p.stock === 0 ? '#dc2626' : '#374151', fontVariantNumeric: 'tabular-nums', textAlign: 'right', minWidth: 60 }}>
                    {p.stock === 0 ? <Tag color="error" style={{ margin: 0 }}>หมด</Tag> : fmt(p.stock)}
                  </span>
                  <InputNumber
                    disabled={submitting} aria-label={`เพิ่มจำนวน ${p.name}`} min={0} precision={0} size="large"
                    value={restockQtys[p.item_id] ?? null}
                    placeholder="0"
                    onChange={v => setRestockQtys(prev => { const next = { ...prev }; if (!v || v <= 0) delete next[p.item_id]; else next[p.item_id] = v; return next; })}
                    style={{ width: 80 }}
                    controls={false}
                  />
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Sales ── */}
        {tab === 'sales' && (
          <>
            <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
              <div style={{ background: '#eff6ff', borderRadius: 8, padding: '8px 16px' }}>
                <span style={{ fontSize: 12, color: '#64748b' }}>ยอดขายรวม </span>
                <span style={{ fontWeight: 700, fontSize: 16, color: '#2563eb' }}>{fmtMoney(totalRevenue)}</span>
              </div>
              <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '8px 16px' }}>
                <span style={{ fontSize: 12, color: '#64748b' }}>รายการขายทั้งหมด </span>
                <span style={{ fontWeight: 700, fontSize: 16, color: '#16a34a' }}>{fmt(sales.length)} รายการ</span>
              </div>
            </div>
            <Table<SaleRecord> columns={salesColumns} dataSource={sales} rowKey="id" size="small" scroll={{ x: 640 }} pagination={{ pageSize: 20, showSizeChanger: false }} locale={{ emptyText: 'ยังไม่มีประวัติการขาย' }} />
          </>
        )}
      </div>

      <Modal title={editing === 'new' ? 'เพิ่มสินค้าในร้าน' : 'จัดการสินค้า'} open={editing !== null} onCancel={() => { if (!savingProduct) setEditing(null); }} maskClosable={!savingProduct} closable={!savingProduct} confirmLoading={savingProduct} onOk={() => void saveProduct()} okText="บันทึกสินค้า" cancelText="ยกเลิก" okButtonProps={{disabled: !validEdit}}>
        <div className="store-editor">
          {editing === 'new' ? <><label>สินค้าจากแคตตาล็อก</label><Select aria-label="สินค้าใหม่" showSearch optionFilterProp="label" placeholder="ค้นหาชื่อสินค้า" value={editId} onChange={setEditId} loading={!apiData}
            options={Object.entries(apiData?.itemNames ?? {}).filter(([id]) => !products.some(p => p.item_id === id)).map(([value,label]) => ({value,label}))}
            optionRender={option => <div className="store-option"><ItemImg src={apiData?.stockImages[String(option.value)]} name={String(option.label)} size={32} />{option.label}</div>} />
            <p>เพิ่มสินค้าโดยเริ่มที่ 0 ชิ้น แล้วเติมจำนวนได้ในแท็บเติมสต็อก</p></> : editing && <div className="store-option"><ItemImg src={getImg(editing)} name={editing.name} size={64} /><h3>{editing.name}</h3></div>}
          <label htmlFor="store-edit-price">ราคาขายต่อชิ้น</label><InputNumber id="store-edit-price" size="large" min={0} precision={2} value={editPrice} onChange={setEditPrice} prefix="฿" />
          {editing && editing !== 'new' && <><label htmlFor="store-edit-stock">ยอดสต็อกที่ถูกต้อง (ชิ้น)</label><InputNumber id="store-edit-stock" size="large" min={0} precision={0} value={editStock} onChange={setEditStock} />
            <p>ปัจจุบัน {fmt(editing.stock)} → หลังบันทึก {fmt(editStock ?? 0)} ชิ้น</p>
            <Popconfirm title={`นำ ${editing.name} ออกจากร้าน?`} description={`ลบรายการสินค้าและสต็อก ${fmt(editing.stock)} ชิ้น ประวัติขายยังอยู่`} okText="นำออกจากร้าน" cancelText="เก็บไว้" onConfirm={() => void deleteProduct()}><Button danger disabled={savingProduct} icon={<DeleteOutlined />}>นำสินค้าออกจากร้าน</Button></Popconfirm></>}
        </div>
      </Modal>
      <SellModal product={sellProduct} storeId={session.storeId} imgSrc={sellProduct ? getImg(sellProduct) : undefined} onClose={() => setSellProduct(null)} onSold={() => { setSellProduct(null); void fetchAll(session.storeId); }} />
    </div>
  );
}

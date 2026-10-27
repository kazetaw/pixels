import { useEffect, useRef, useState, useMemo, type ReactNode } from 'react';
import {
  Alert, Badge, Button, ConfigProvider, Dropdown, Empty, Input, InputNumber,
  Modal, Popconfirm, Segmented, Select, Spin, Table, Tag, Tooltip, message,
} from 'antd';
import type { ThemeConfig } from 'antd';
import {
  AppstoreOutlined, BarsOutlined, DeleteOutlined, EditOutlined, LogoutOutlined, MoreOutlined,
  PlusOutlined, ReloadOutlined, SearchOutlined, ShopOutlined, ShoppingCartOutlined, InboxOutlined,
  ThunderboltOutlined, DatabaseOutlined, RiseOutlined, WarningOutlined, CheckCircleOutlined, CameraOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { fetchAllData } from '../../api/client';
import type { AppData } from '../../types';
import { SalesChart } from './SalesChart';
import './StorePage.css';

// ── Types ─────────────────────────────────────────────────────────────────────
type StoreRow = { id: string; name: string; logo_url?: string | null };
type Session = { storeId: string; storeName: string; logo: string | null };
type StoreProduct = { item_id: string; name: string; image_url: string | null; price: number; stock: number };
type SaleRecord = { id: string; item_id: string; item_name: string; image_url: string | null; qty: number; price_per_unit: number; total: number; note: string; sold_at: string };
type Tab = 'overview' | 'restock' | 'sales';

// ── Sky · Sun · White theme (scoped to /store) ────────────────────────────────
const SKY = '#0284C7';
const LINE = '#E0F2FE';

const shopTheme: ThemeConfig = {
  token: {
    colorPrimary: SKY,
    colorInfo: SKY,
    colorWarning: '#EAB308',
    colorSuccess: '#16A34A',
    colorError: '#E11D48',
    colorLink: SKY,
    colorBgLayout: '#F0F9FF',
    colorBgContainer: '#FFFFFF',
    colorBgElevated: '#FFFFFF',
    colorText: '#0C1E33',
    colorTextSecondary: '#3B5470',
    colorTextTertiary: '#64748B',
    colorTextPlaceholder: '#94A3B8',
    colorBorder: '#BAE6FD',
    colorBorderSecondary: LINE,
    borderRadius: 10,
    borderRadiusLG: 16,
    borderRadiusSM: 6,
    controlHeight: 38,
    fontSize: 14,
    fontFamily: "'Inter', 'IBM Plex Sans Thai', 'Noto Sans Thai', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  components: {
    Segmented: { itemSelectedBg: '#FACC15', trackBg: '#E0F2FE', itemColor: '#075985', itemHoverColor: '#0C1E33', itemSelectedColor: '#0C1E33' },
    Table: { headerBg: '#E0F2FE', headerColor: '#075985', rowHoverBg: '#FEFCE8', borderColor: LINE, cellPaddingBlock: 12 },
    Button: { primaryShadow: 'none', defaultShadow: 'none', dangerShadow: 'none', fontWeight: 600 },
    Modal: { borderRadiusLG: 16 },
  },
};

// Logos are stored as a 256px PNG (fixed path per store, so a new upload replaces the old one).
async function toPngBlob(file: File, size = 256): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = url; });
    const scale = Math.min(1, size / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * scale)); canvas.height = Math.max(1, Math.round(img.height * scale));
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('แปลงรูปไม่สำเร็จ')), 'image/png'));
  } finally { URL.revokeObjectURL(url); }
}

function StoreLogo({ src, size = 36 }: { src?: string | null; size?: number }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  return (
    <span className="shop-mark" style={{ width: size, height: size, fontSize: size * 0.48 }}>
      {src && !broken ? <img src={src} alt="โลโก้ร้าน" onError={() => setBroken(true)} /> : <ShopOutlined />}
    </span>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number) { return n.toLocaleString('th-TH'); }
function fmtMoney(n: number) { return `฿${new Intl.NumberFormat('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n)}`; }

function ItemImg({ src, name, size = 40 }: { src?: string | null; name: string; size?: number }) {
  return (
    <span className="shop-thumb" style={{ width: size, height: size }}>
      {src ? <img src={src} alt={name} loading="lazy" /> : <InboxOutlined style={{ fontSize: size * 0.42 }} />}
    </span>
  );
}

const LOW_STOCK = 5;

function Kpi({ icon, label, value, unit, tone }: { icon: ReactNode; label: string; value: string; unit?: string; tone?: 'danger' | 'ok' | 'sky' | 'sun' }) {
  return (
    <div className={`shop-kpi${tone ? ` is-${tone}` : ''}`}>
      <span className="shop-kpi__icon" aria-hidden>{icon}</span>
      <dt>{label}</dt>
      <dd>{value}{unit && <small>{unit}</small>}</dd>
    </div>
  );
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
    <div className="shop-pin">
      {digits.map((d, i) => (
        <div key={i} className={`shop-pin__dot${d ? ' is-filled' : ''}${error ? ' is-error' : ''}`}>
          {d && <span />}
          <input ref={el => { refs.current[i] = el; }} aria-label={`PIN หลักที่ ${i + 1}`} type="password" inputMode="numeric" maxLength={1} value={d}
            onChange={e => handleDigit(i, e.target.value)}
            onKeyDown={e => { if (e.key === 'Backspace' && !d && i > 0) refs.current[i - 1]?.focus(); }} />
        </div>
      ))}
    </div>
  );
}

function StoreGate({ onEntered }: { onEntered: (id: string, name: string, logo: string | null) => void }) {
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
      onEntered(data.id, data.name, null);
    } catch { void message.error('สร้างร้านไม่สำเร็จ'); }
    finally { setCreating(false); }
  };

  const handlePin = async (pin: string) => {
    if (!selectedId || verifying) return;
    setVerifying(true);
    try {
      const res = await fetch('/api/store/verify-pin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ store_id: selectedId, pin }) });
      if (!res.ok) { setPinError(true); return; }
      const store = stores?.find(s => s.id === selectedId);
      onEntered(selectedId, store?.name ?? '', store?.logo_url ?? null);
    } catch { setPinError(true); }
    finally { setVerifying(false); }
  };

  const creatingNew = stores?.length === 0;
  return (
    <div className="shop-gate">
      {loading ? <Spin /> : (
        <div className="shop-gate__card">
          <StoreLogo src={stores?.find(s => s.id === selectedId)?.logo_url} size={64} />
          <h1>{creatingNew ? 'สร้างร้านใหม่' : 'เข้าร้านค้า'}</h1>
          <p className="shop-muted">{creatingNew ? 'ตั้งชื่อร้านและ PIN 4 หลัก' : 'เลือกร้าน แล้วกรอก PIN 4 หลัก'}</p>
          {creatingNew ? (
            <div className="shop-form">
              <label>ชื่อร้าน<Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="เช่น ร้านค้าหลัก" maxLength={100} /></label>
              <label>PIN<Input.Password value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="0000" inputMode="numeric" maxLength={4} /></label>
              <Button type="primary" block loading={creating} disabled={!newName.trim() || newPin.length !== 4} onClick={() => void handleCreate()}>สร้างร้าน</Button>
            </div>
          ) : (
            <div className="shop-form">
              <Select style={{ width: '100%' }} placeholder="เลือกร้าน" value={selectedId} onChange={v => { setSelectedId(v); setPinError(false); }} options={(stores ?? []).map(s => ({ value: s.id, label: s.name }))} />
              {selectedId && <>
                <PinDots onSubmit={handlePin} error={pinError} onClear={() => setPinError(false)} />
                <div className="shop-gate__status">{pinError ? <span className="shop-danger">PIN ไม่ถูกต้อง</span> : verifying ? 'กำลังตรวจสอบ…' : ' '}</div>
              </>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sell Modal ────────────────────────────────────────────────────────────────
function SellModal({ product, storeId, imgSrc, onClose, onSold }: { product: StoreProduct | null; storeId: string; imgSrc?: string; onClose: () => void; onSold: () => void }) {
  const [qty, setQty] = useState<number | null>(1);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (product) { setQty(1); setNote(''); } }, [product?.item_id]);
  const valid = !!product && !!qty && Number.isSafeInteger(qty) && qty >= 1 && qty <= product.stock;

  const handleSell = async () => {
    if (!product || !valid || saving) return;
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
    <Modal open={!!product} title="บันทึกการขาย" width={400} okText={valid ? `ขาย · ${fmtMoney((product?.price ?? 0) * (qty ?? 0))}` : 'ยืนยันขาย'} cancelText="ยกเลิก"
      onOk={() => void handleSell()} onCancel={() => { if (!saving) onClose(); }} closable={!saving} mask={{ closable: !saving }} confirmLoading={saving}
      okButtonProps={{ disabled: !valid }}>
      {product && (
        <div className="shop-modal">
          <div className="shop-modal__item">
            <ItemImg src={imgSrc} name={product.name} size={44} />
            <div>
              <strong>{product.name}</strong>
              <span className="shop-muted">{fmtMoney(product.price)} / ชิ้น · คงเหลือ {fmt(product.stock)}</span>
            </div>
          </div>
          <label className="shop-field">จำนวน
            <InputNumber autoFocus aria-label="จำนวนที่ขาย" min={1} max={product.stock} precision={0} value={qty} onChange={setQty} style={{ width: '100%' }}
              onPressEnter={() => void handleSell()} />
          </label>
          <div className="shop-chips">
            {[1, 5, 10].filter(n => n <= product.stock).map(n => <Button key={n} size="small" type={qty === n ? 'primary' : 'default'} onClick={() => setQty(n)}>{n}</Button>)}
            <Button size="small" type={qty === product.stock ? 'primary' : 'default'} onClick={() => setQty(product.stock)}>ทั้งหมด ({fmt(product.stock)})</Button>
          </div>
          <label className="shop-field"><span>หมายเหตุ <span className="shop-muted">· ไม่บังคับ</span></span>
            <Input value={note} onChange={e => setNote(e.target.value)} placeholder="เช่น ลูกค้า VIP" maxLength={200} />
          </label>
          <div className="shop-modal__sum"><span>หลังขายเหลือ {fmt(Math.max(0, product.stock - (qty ?? 0)))} ชิ้น</span></div>
        </div>
      )}
    </Modal>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function StorePage() {
  return <ConfigProvider theme={shopTheme}><StoreApp /></ConfigProvider>;
}

function StoreApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInput = useRef<HTMLInputElement>(null);
  const uploadLogo = async (file: File | undefined) => {
    if (!file || !session || uploadingLogo) return;
    if (!file.type.startsWith('image/')) { void msgApi.error('เลือกไฟล์รูปภาพเท่านั้น'); return; }
    setUploadingLogo(true);
    try {
      const form = new FormData();
      form.append('bucket', 'images'); form.append('folder', 'stores'); form.append('itemId', session.storeId);
      form.append('file', await toPngBlob(file), 'logo.png');
      const res = await fetch('/api/upload-image', { method: 'POST', body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) throw new Error(data.error || 'อัปโหลดโลโก้ไม่สำเร็จ');
      setSession(s => s && { ...s, logo: `${data.url}?v=${Date.now()}` });
      void msgApi.success('เปลี่ยนรูปร้านแล้ว');
    } catch (e) { void msgApi.error(e instanceof Error ? e.message : 'อัปโหลดโลโก้ไม่สำเร็จ'); }
    finally { setUploadingLogo(false); if (logoInput.current) logoInput.current.value = ''; }
  };

  // Quick restock (one item, from the header button on the restock tab)
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickId, setQuickId] = useState<string>();
  const [quickQty, setQuickQty] = useState<number | null>(null);
  const [quickSaving, setQuickSaving] = useState(false);
  const quickValid = !!quickId && quickQty !== null && Number.isSafeInteger(quickQty) && quickQty > 0;
  const saveQuickRestock = async () => {
    if (!session || !quickValid || quickSaving) return;
    setQuickSaving(true);
    try {
      const res = await fetch(`/api/store/${session.storeId}/restock`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item_id: quickId, qty: quickQty }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'เติมสต็อกไม่สำเร็จ');
      void msgApi.success(`เติม ${products.find(p => p.item_id === quickId)?.name ?? ''} +${fmt(quickQty!)} ชิ้นแล้ว`);
      setQuickOpen(false); await fetchAll(session.storeId);
    } catch (e) { void msgApi.error(e instanceof Error ? e.message : 'เติมสต็อกไม่สำเร็จ'); }
    finally { setQuickSaving(false); }
  };
  const openQuickRestock = (id?: string) => { setQuickId(id); setQuickQty(null); setQuickOpen(true); };
  const [tab, setTab] = useState<Tab>('overview');
  const [apiData, setApiData] = useState<AppData | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [sellProduct, setSellProduct] = useState<StoreProduct | null>(null);
  const [msgApi, ctx] = message.useMessage();

  // Bulk restock state
  const [restockSearch, setRestockSearch] = useState('');
  const [restockFilter, setRestockFilter] = useState<'all' | 'empty' | 'pending'>('all');
  const [restockQtys, setRestockQtys] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  // Overview
  const [overviewSearch, setOverviewSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'ready' | 'empty'>('all');
  const [view, setView] = useState<'grid' | 'list'>(() => {
    try { return localStorage.getItem('shop-view') === 'list' ? 'list' : 'grid'; } catch { return 'grid'; }
  });
  useEffect(() => { try { localStorage.setItem('shop-view', view); } catch { /* ignore */ } }, [view]);

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
      // New products start at 0 — apply the initial quantity as a normal restock so it is logged.
      if (editing === 'new' && editStock && editStock > 0) {
        const r = await fetch(`/api/store/${session.storeId}/restock`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item_id: editId, qty: editStock }) });
        if (!r.ok) void msgApi.warning('เพิ่มสินค้าแล้ว แต่เติมจำนวนเริ่มต้นไม่สำเร็จ กรุณาเติมสต็อกอีกครั้ง');
      }
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
  const totalSold = sales.reduce((s, r) => s + Number(r.qty), 0);
  const outOfStock = products.filter(p => p.stock === 0).length;
  const lowStock = useMemo(() => products.filter(p => p.stock <= LOW_STOCK).sort((a, b) => a.stock - b.stock), [products]);

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
  const pendingUnits = Object.values(restockQtys).reduce((s, q) => s + (q > 0 ? q : 0), 0);

  // In-stock items first, so the sellable ones are always at the top.
  const filteredOverview = useMemo(() => {
    const q = overviewSearch.toLowerCase().trim();
    return products
      .filter(p => (!q || p.name.toLowerCase().includes(q)) && (stockFilter === 'all' || (stockFilter === 'ready' ? p.stock > 0 : p.stock === 0)))
      .sort((a, b) => Number(b.stock > 0) - Number(a.stock > 0));
  }, [products, overviewSearch, stockFilter]);

  const filteredRestock = useMemo(() => {
    const q = restockSearch.toLowerCase().trim();
    return products.filter(p => (!q || p.name.toLowerCase().includes(q))
      && (restockFilter === 'all' || (restockFilter === 'empty' ? p.stock === 0 : (restockQtys[p.item_id] ?? 0) > 0)));
  }, [products, restockSearch, restockFilter, restockQtys]);

  const goRestock = (p: StoreProduct) => openQuickRestock(p.item_id);

  const moreMenu = (p: StoreProduct) => ({
    items: [
      { key: 'edit', icon: <EditOutlined />, label: 'แก้ไขราคา / สต็อก' },
      { key: 'restock', icon: <PlusOutlined />, label: 'เติมสต็อก' },
    ],
    onClick: ({ key }: { key: string }) => { if (key === 'edit') openEditor(p); else goRestock(p); },
  });

  const productColumns: ColumnsType<StoreProduct> = [
    { title: 'สินค้า', key: 'name', render: (_, p) => <div className="shop-cell"><ItemImg src={getImg(p)} name={p.name} size={28} /><span>{p.name}</span></div> },
    { title: 'คงเหลือ', dataIndex: 'stock', align: 'right', width: 110, sorter: (a, b) => a.stock - b.stock,
      render: (v: number) => v === 0 ? <Tag color="error" variant="filled">หมด</Tag> : <span className="shop-num">{fmt(v)}</span> },
    { title: 'ราคา', dataIndex: 'price', align: 'right', width: 110, sorter: (a, b) => a.price - b.price, render: (v: number) => <span className="shop-num">{fmtMoney(v)}</span> },
    { title: '', key: 'act', align: 'right', width: 120, render: (_, p) => <div className="shop-row-actions">
      <Button size="small" type="primary" disabled={p.stock === 0} onClick={() => setSellProduct(p)}>ขาย</Button>
      <Dropdown menu={moreMenu(p)} trigger={['click']} placement="bottomRight"><Button size="small" type="text" icon={<MoreOutlined />} aria-label={`ตัวเลือก ${p.name}`} /></Dropdown>
    </div> },
  ];

  const restockColumns: ColumnsType<StoreProduct> = [
    { title: 'สินค้า', key: 'name', render: (_, p) => <div className="shop-cell"><ItemImg src={getImg(p)} name={p.name} size={28} /><span>{p.name}</span></div> },
    { title: 'คงเหลือ', dataIndex: 'stock', align: 'right', width: 100, render: (v: number) => v === 0 ? <Tag color="error" variant="filled">หมด</Tag> : <span className="shop-num">{fmt(v)}</span> },
    { title: 'เพิ่ม (ชิ้น)', key: 'qty', align: 'right', width: 130, render: (_, p) => (
      <InputNumber disabled={submitting} aria-label={`เพิ่มจำนวน ${p.name}`} min={0} precision={0} controls={false} placeholder="0" style={{ width: 96 }}
        value={restockQtys[p.item_id] ?? null}
        onChange={v => setRestockQtys(prev => { const next = { ...prev }; if (!v || v <= 0) delete next[p.item_id]; else next[p.item_id] = v; return next; })} />
    ) },
  ];

  const salesColumns: ColumnsType<SaleRecord> = [
    { title: 'วันที่', dataIndex: 'sold_at', width: 150, render: (v: string) => <span className="shop-muted">{new Date(v).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</span> },
    { title: 'สินค้า', key: 'item', render: (_: unknown, r) => <div className="shop-cell"><ItemImg src={r.image_url} name={r.item_name} size={26} /><span>{r.item_name}</span></div> },
    { title: 'จำนวน', dataIndex: 'qty', align: 'right', width: 80, render: (v: number) => <span className="shop-num">{fmt(v)}</span> },
    { title: 'ราคา/ชิ้น', dataIndex: 'price_per_unit', align: 'right', width: 100, render: (v: number) => <span className="shop-num">{fmtMoney(v)}</span> },
    { title: 'รวม', dataIndex: 'total', align: 'right', width: 110, render: (v: number) => <strong className="shop-num">{fmtMoney(Number(v))}</strong> },
    { title: 'หมายเหตุ', dataIndex: 'note', ellipsis: true, render: (v: string) => v || <span className="shop-muted">—</span> },
    { title: '', key: 'del', width: 48, render: (_: unknown, r) => <Popconfirm title="ลบประวัติการขายนี้?" description="ยอดขายรวมจะลดลง แต่สต็อกจะไม่ถูกคืน" okText="ลบ" cancelText="เก็บไว้" okButtonProps={{ danger: true }} onConfirm={async () => {
      if (deletingSale) return; setDeletingSale(r.id);
      try { const res = await fetch(`/api/store/${session!.storeId}/sales/${r.id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(); setSales(prev => prev.filter(s => s.id !== r.id)); void msgApi.success('ลบประวัติแล้ว');
      } catch { void msgApi.error('ลบประวัติไม่สำเร็จ กรุณาลองอีกครั้ง'); } finally { setDeletingSale(null); }
    }}><Button aria-label={`ลบประวัติขาย ${r.item_name}`} loading={deletingSale === r.id} disabled={!!deletingSale} size="small" type="text" icon={<DeleteOutlined />} /></Popconfirm> },
  ];

  if (!session) return <StoreGate onEntered={(id, name, logo) => setSession({ storeId: id, storeName: name, logo })} />;

  const heading: Record<Tab, [string, string]> = {
    overview: ['หน้าร้าน', 'เลือกสินค้าแล้วกดขาย — สินค้าที่มีของจะแสดงก่อน'],
    restock: ['เติมสต็อก', 'กรอกจำนวนที่ได้รับเพิ่มในช่อง "เพิ่ม (ชิ้น)" ได้หลายรายการ แล้วกดบันทึกครั้งเดียว'],
    sales: ['ประวัติขาย', 'รายการขายทั้งหมดของร้าน'],
  };

  return (
    <div className="shop">
      {ctx}
      <header className="shop-bar">
        <div className="shop-bar__inner">
          <div className="shop-brand">
            <Tooltip title="เปลี่ยนรูปร้าน">
              <button type="button" className="shop-logo-btn" aria-label="เปลี่ยนรูปร้าน" disabled={uploadingLogo} onClick={() => logoInput.current?.click()}>
                <StoreLogo src={session.logo} size={40} />
                <span className="shop-logo-btn__edit">{uploadingLogo ? <Spin size="small" /> : <CameraOutlined />}</span>
              </button>
            </Tooltip>
            <input ref={logoInput} type="file" accept="image/*" hidden onChange={e => void uploadLogo(e.target.files?.[0])} />
            <span className="shop-brand__name">{session.storeName}</span>
          </div>
          <Segmented<Tab> className="shop-tabs" value={tab} onChange={setTab} options={[
            { value: 'overview', label: 'หน้าร้าน' },
            { value: 'restock', label: <Badge count={pendingCount} size="small" offset={[8, -2]}>เติมสต็อก</Badge> },
            { value: 'sales', label: 'ประวัติขาย' },
          ]} />
          <div className="shop-bar__end"><Tooltip title="ออกจากร้าน"><Button type="text" icon={<LogoutOutlined />} aria-label="ออกจากร้าน"
            onClick={() => { setSession(null); setProducts([]); setSales([]); setApiData(null); setRestockQtys({}); setTab('overview'); }} /></Tooltip></div>
        </div>
      </header>

      <main className="shop-main">
        <div className="shop-head">
          <div><h1>{heading[tab][0]}</h1><p>{heading[tab][1]}</p></div>
          {tab === 'overview' && <Button type="primary" icon={<PlusOutlined />} onClick={() => openEditor('new')}>เพิ่มสินค้าในร้าน</Button>}
          {tab === 'restock' && <Button className="shop-btn-sun" icon={<PlusOutlined />} onClick={() => openQuickRestock()}>เติมสต็อกทีละรายการ</Button>}
        </div>
        {loadError && <Alert className="shop-alert" type="error" showIcon message={loadError} action={<Button size="small" onClick={() => void fetchAll(session.storeId)}>ลองใหม่</Button>} />}

        {/* ── Overview ── */}
        {tab === 'overview' && (
          <>
            <dl className="shop-stats">
              <Kpi icon={<AppstoreOutlined />} label="สินค้า" value={fmt(products.length)} unit="รายการ" />
              <Kpi icon={<DatabaseOutlined />} label="สต็อกรวม" value={fmt(totalStock)} unit="ชิ้น" tone="sky" />
              <Kpi icon={<ThunderboltOutlined />} label="ยอดขายรวม" value={fmtMoney(totalRevenue)} tone="sun" />
              <Kpi icon={<WarningOutlined />} label="หมดสต็อก" value={fmt(outOfStock)} unit="รายการ" tone={outOfStock ? 'danger' : undefined} />
            </dl>

            <div className="shop-toolbar">
              <Input className="shop-search" prefix={<SearchOutlined className="shop-muted" />} placeholder="ค้นหาสินค้า" value={overviewSearch} onChange={e => setOverviewSearch(e.target.value)} allowClear />
              <Segmented size="middle" value={stockFilter} onChange={setStockFilter} options={[
                { value: 'all', label: `ทั้งหมด ${products.length}` },
                { value: 'ready', label: `พร้อมขาย ${products.length - outOfStock}` },
                { value: 'empty', label: `หมด ${outOfStock}` },
              ]} />
              <div className="shop-toolbar__end">
                <Segmented value={view} onChange={setView} options={[
                  { value: 'grid', icon: <AppstoreOutlined />, title: 'มุมมองการ์ด' },
                  { value: 'list', icon: <BarsOutlined />, title: 'มุมมองตาราง' },
                ]} />
                <Tooltip title="รีเฟรช"><Button icon={<ReloadOutlined />} loading={loading} aria-label="รีเฟรช" onClick={() => void fetchAll(session.storeId)} /></Tooltip>
              </div>
            </div>

            {loading && !products.length ? <div className="shop-center"><Spin /></div>
              : filteredOverview.length === 0 ? <Empty className="shop-empty" image={Empty.PRESENTED_IMAGE_SIMPLE} description="ไม่พบสินค้า" />
              : view === 'list' ? (
                <Table<StoreProduct> className="shop-table" columns={productColumns} dataSource={filteredOverview} rowKey="item_id" size="middle" scroll={{ x: 520 }}
                  pagination={filteredOverview.length > 30 ? { pageSize: 30, showSizeChanger: false, size: 'small' } : false}
                  rowClassName={p => p.stock === 0 ? 'is-out' : ''} />
              ) : (
                <div className="shop-grid">
                  {filteredOverview.map(p => {
                    const empty = p.stock === 0;
                    return (
                      <article key={p.item_id} className={`shop-card${empty ? ' is-out' : ''}`}>
                        <Dropdown menu={moreMenu(p)} trigger={['click']} placement="bottomRight">
                          <Button className="shop-card__more" size="small" type="text" icon={<MoreOutlined />} aria-label={`ตัวเลือก ${p.name}`} />
                        </Dropdown>
                        <ItemImg src={getImg(p)} name={p.name} size={48} />
                        <h3 title={p.name}>{p.name}</h3>
                        <div className="shop-card__meta">
                          <span className="shop-card__price">{fmtMoney(p.price)}</span>
                          <span className={empty ? 'shop-danger' : 'shop-muted'}>{empty ? 'หมด' : `${fmt(p.stock)} ชิ้น`}</span>
                        </div>
                        {empty
                          ? <Button size="small" block onClick={() => goRestock(p)} icon={<PlusOutlined />}>เติมสต็อก</Button>
                          : <Button size="small" block type="primary" icon={<ShoppingCartOutlined />} onClick={() => setSellProduct(p)}>ขาย</Button>}
                      </article>
                    );
                  })}
                </div>
              )}
          </>
        )}

        {/* ── Bulk Restock ── */}
        {tab === 'restock' && (
          <>
            <div className="shop-toolbar">
              <Input className="shop-search" prefix={<SearchOutlined className="shop-muted" />} placeholder="ค้นหาสินค้า" value={restockSearch} onChange={e => setRestockSearch(e.target.value)} allowClear />
              <Segmented value={restockFilter} onChange={setRestockFilter} options={[
                { value: 'all', label: 'ทั้งหมด' },
                { value: 'empty', label: `หมด ${outOfStock}` },
                { value: 'pending', label: `กรอกแล้ว ${pendingCount}` },
              ]} />
            </div>
            <Table<StoreProduct> className="shop-table" columns={restockColumns} dataSource={filteredRestock} rowKey="item_id" size="middle" scroll={{ x: 420 }}
              pagination={false} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="ไม่พบสินค้า" /> }}
              rowClassName={p => (restockQtys[p.item_id] ?? 0) > 0 ? 'is-pending' : ''} />
            <div className={`shop-dock${pendingCount ? ' is-visible' : ''}`} aria-hidden={!pendingCount}>
              <span><b>{pendingCount}</b> รายการ · <b>{fmt(pendingUnits)}</b> ชิ้น</span>
              <div>
                <Button type="text" disabled={submitting} onClick={() => setRestockQtys({})}>ล้าง</Button>
                <Button type="primary" loading={submitting} onClick={() => void handleBulkRestock()}>บันทึกเติมสต็อก</Button>
              </div>
            </div>
          </>
        )}

        {/* ── Sales ── */}
        {tab === 'sales' && (
          <>
            <dl className="shop-stats shop-stats--3">
              <Kpi icon={<ThunderboltOutlined />} label="ยอดขายรวม" value={fmtMoney(totalRevenue)} tone="sun" />
              <Kpi icon={<RiseOutlined />} label="รายการขาย" value={fmt(sales.length)} unit="ครั้ง" tone="sky" />
              <Kpi icon={<ShoppingCartOutlined />} label="ขายไปแล้ว" value={fmt(totalSold)} unit="ชิ้น" />
            </dl>
            <div className="shop-dash">
              <section className="shop-panel shop-dash__chart">
                <header><h2>ยอดขายรายวัน</h2><span className="shop-muted">14 วันล่าสุด</span></header>
                <SalesChart sales={sales} fmtMoney={fmtMoney} />
              </section>
              <section className="shop-panel shop-dash__alerts">
                <header><h2>แจ้งเตือนสต็อก</h2><span className="shop-muted">{fmt(lowStock.length)} รายการ</span></header>
                {lowStock.length === 0
                  ? <div className="shop-ok"><CheckCircleOutlined /> สต็อกปกติทุกรายการ</div>
                  : <ul className="shop-alerts">{lowStock.slice(0, 6).map(p => (
                    <li key={p.item_id} className={p.stock === 0 ? 'is-out' : ''}>
                      <ItemImg src={getImg(p)} name={p.name} size={28} />
                      <span>{p.name}<small>{p.stock === 0 ? 'หมดสต็อก' : `เหลือ ${fmt(p.stock)} ชิ้น`}</small></span>
                      <Button size="small" type="text" icon={<PlusOutlined />} aria-label={`เติมสต็อก ${p.name}`} onClick={() => goRestock(p)} />
                    </li>))}
                  </ul>}
              </section>
            </div>
            <Table<SaleRecord> className="shop-table" columns={salesColumns} dataSource={sales} rowKey="id" size="middle" scroll={{ x: 680 }}
              pagination={{ pageSize: 20, showSizeChanger: false, size: 'small', hideOnSinglePage: true }}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="ยังไม่มีประวัติการขาย" /> }} />
          </>
        )}
      </main>

      <Modal title={editing === 'new' ? 'เพิ่มสินค้าในร้าน' : 'แก้ไขสินค้า'} width={420} open={editing !== null} onCancel={() => { if (!savingProduct) setEditing(null); }} mask={{ closable: !savingProduct }} closable={!savingProduct}
        confirmLoading={savingProduct} onOk={() => void saveProduct()} okText="บันทึก" cancelText="ยกเลิก" okButtonProps={{ disabled: !validEdit }}>
        <div className="shop-modal">
          {editing === 'new' ? <label className="shop-field">สินค้าจากแคตตาล็อก
            <Select aria-label="สินค้าใหม่" showSearch optionFilterProp="label" placeholder="ค้นหาชื่อสินค้า" value={editId} onChange={setEditId} loading={!apiData}
              options={Object.entries(apiData?.itemNames ?? {}).filter(([id]) => !products.some(p => p.item_id === id)).map(([value, label]) => ({ value, label }))}
              optionRender={option => <div className="shop-cell"><ItemImg src={apiData?.stockImages[String(option.value)]} name={String(option.label)} size={24} />{option.label}</div>} />
          </label> : editing && <div className="shop-modal__item"><ItemImg src={getImg(editing)} name={editing.name} size={44} /><div><strong>{editing.name}</strong><span className="shop-muted">คงเหลือ {fmt(editing.stock)} ชิ้น</span></div></div>}
          <label className="shop-field">ราคาขายต่อชิ้น<InputNumber id="store-edit-price" min={0} precision={2} value={editPrice} onChange={setEditPrice} prefix="฿" style={{ width: '100%' }} /></label>
          {editing === 'new' && <label className="shop-field">จำนวนเริ่มต้น
            <InputNumber min={0} precision={0} value={editStock} onChange={setEditStock} suffix="ชิ้น" style={{ width: '100%' }} />
            <span className="shop-muted">ใส่ 0 ได้ แล้วค่อยเติมทีหลัง</span>
          </label>}
          {editing && editing !== 'new' && <>
            <label className="shop-field">ยอดสต็อกที่ถูกต้อง
              <InputNumber id="store-edit-stock" min={0} precision={0} value={editStock} onChange={setEditStock} suffix="ชิ้น" style={{ width: '100%' }} />
              {editStock !== editing.stock && <span className="shop-muted">{fmt(editing.stock)} → {fmt(editStock ?? 0)} ชิ้น</span>}
            </label>
            <Popconfirm title={`นำ ${editing.name} ออกจากร้าน?`} description={`ลบสินค้าและสต็อก ${fmt(editing.stock)} ชิ้น ประวัติขายยังอยู่`} okText="นำออก" cancelText="เก็บไว้" okButtonProps={{ danger: true }} onConfirm={() => void deleteProduct()}>
              <Button className="shop-modal__danger" type="text" danger size="small" disabled={savingProduct} icon={<DeleteOutlined />}>นำสินค้าออกจากร้าน</Button>
            </Popconfirm>
          </>}
        </div>
      </Modal>
      <Modal title="เติมสต็อก" width={420} open={quickOpen} onCancel={() => { if (!quickSaving) setQuickOpen(false); }} mask={{ closable: !quickSaving }} closable={!quickSaving}
        confirmLoading={quickSaving} onOk={() => void saveQuickRestock()} okText={quickValid ? `เติม +${fmt(quickQty!)} ชิ้น` : 'เติมสต็อก'} cancelText="ยกเลิก" okButtonProps={{ disabled: !quickValid }}>
        <div className="shop-modal">
          <label className="shop-field">สินค้า
            <Select aria-label="สินค้าที่จะเติม" showSearch optionFilterProp="label" placeholder="ค้นหาชื่อสินค้า" value={quickId} onChange={setQuickId}
              options={products.map(p => ({ value: p.item_id, label: p.name }))}
              optionRender={option => { const p = products.find(x => x.item_id === option.value); return <div className="shop-cell"><ItemImg src={p && getImg(p)} name={String(option.label)} size={24} /><span>{option.label}</span><span className="shop-muted" style={{ marginLeft: 'auto' }}>{p ? fmt(p.stock) : ''}</span></div>; }} />
          </label>
          <label className="shop-field">จำนวนที่ได้รับเพิ่ม
            <InputNumber autoFocus min={1} precision={0} value={quickQty} onChange={setQuickQty} suffix="ชิ้น" placeholder="0" style={{ width: '100%' }} onPressEnter={() => void saveQuickRestock()} />
          </label>
          <div className="shop-chips">{[10, 50, 100, 500].map(n => <Button key={n} size="small" type={quickQty === n ? 'primary' : 'default'} onClick={() => setQuickQty(n)}>+{n}</Button>)}</div>
          {quickId && (() => { const p = products.find(x => x.item_id === quickId); return p && <div className="shop-modal__sum">คงเหลือ {fmt(p.stock)} → <b>{fmt(p.stock + (quickQty ?? 0))}</b> ชิ้น</div>; })()}
        </div>
      </Modal>
      <SellModal product={sellProduct} storeId={session.storeId} imgSrc={sellProduct ? getImg(sellProduct) : undefined} onClose={() => setSellProduct(null)} onSold={() => { setSellProduct(null); void fetchAll(session.storeId); }} />
    </div>
  );
}

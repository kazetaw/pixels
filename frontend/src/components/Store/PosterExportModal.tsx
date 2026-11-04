import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Checkbox, Input, Modal, Segmented, Spin, Empty, Divider } from 'antd';
import { DownloadOutlined, InboxOutlined, SearchOutlined, ShareAltOutlined, ExpandOutlined } from '@ant-design/icons';
import { toPngBlob } from './profileImage';
import { posterGeometry, renderStorePosters, type PosterItem, type PosterStyle } from './storePoster';

type Props = { open: boolean; onClose: () => void; items: PosterItem[]; storeName: string; storeId: string; unit: string };
type Page = { url: string; blob: Blob };

const toBlob = (c: HTMLCanvasElement) => new Promise<Blob>((resolve, reject) =>
  c.toBlob(b => b ? resolve(b) : reject(new Error('สร้างรูปไม่สำเร็จ')), 'image/png'));
const money = (n: number) => `฿${new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 }).format(n)}`;

const STYLE_OPTIONS: { value: PosterStyle; label: string }[] = [
  { value: 'card', label: 'การ์ด' },
  { value: 'soft', label: 'นุ่ม' },
  { value: 'minimal', label: 'มินิมอล' },
];

// ── Design settings persisted to localStorage ──────────────────────
type DesignSettings = {
  footer: string;
  perPage: 4 | 9 | 16;
  posterStyle: PosterStyle;
  showStock: boolean;
  textAlign: 'left' | 'center' | 'right';
  imgSize: 'xs' | 'small' | 'medium' | 'large';
  imgPosition: 'top' | 'center' | 'bottom';
  pillPosition: 'right' | 'left' | 'inline';
  showBahtSymbol: boolean;
  priceColor: string;
  pillBg: string;
  pillFg: string;
  // 0 = auto from layout
  nameFontSize: number;
  priceFontSize: number;
  stockFontSize: number;
};

const DESIGN_DEFAULTS: DesignSettings = {
  footer: 'FB: เป็ด ก๊าบ กั๊บ ก๊าบบ',
  perPage: 4,
  posterStyle: 'card',
  showStock: true,
  textAlign: 'center',
  imgSize: 'medium',
  imgPosition: 'center',
  pillPosition: 'right',
  showBahtSymbol: true,
  priceColor: '#0C1E33',
  pillBg: '#FACC15',
  pillFg: '#713F12',
  nameFontSize: 0,
  priceFontSize: 0,
  stockFontSize: 0,
};

function loadDesign(key: string): DesignSettings {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return DESIGN_DEFAULTS;
    return { ...DESIGN_DEFAULTS, ...JSON.parse(raw) as Partial<DesignSettings> };
  } catch { return DESIGN_DEFAULTS; }
}
function saveDesign(key: string, d: DesignSettings) {
  try { localStorage.setItem(key, JSON.stringify(d)); } catch { /* quota */ }
}

// ── Labelled control row ───────────────────────────────────────────
function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="pe-row">
      <span className="pe-row__label">{label}</span>
      <div className="pe-row__ctrl">{children}</div>
    </div>
  );
}

// ── Checkbox toggle row (replaces Ant Switch) ──────────────────────
function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="pe-check-row">
      <span>{label}</span>
      <Checkbox checked={checked} onChange={e => onChange(e.target.checked)} />
    </label>
  );
}


// ── Color swatch → native color picker + hex input ────────────────
function ColorSwatch({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(value);

  // Keep draft in sync when value changes externally
  useEffect(() => { setDraft(value); }, [value]);

  const commit = (raw: string) => {
    const hex = raw.trim();
    // Accept shorthand (#abc → #aabbcc) or full 6-digit hex
    const short = /^#?([0-9a-f]{3})$/i.exec(hex);
    const full  = /^#?([0-9a-f]{6})$/i.exec(hex);
    if (short) {
      const expanded = '#' + [...short[1]].map(c => c + c).join('');
      onChange(expanded); setDraft(expanded);
    } else if (full) {
      const canonical = '#' + full[1].toLowerCase();
      onChange(canonical); setDraft(canonical);
    } else {
      // Revert draft to last valid value
      setDraft(value);
    }
  };

  return (
    <div className="pe-color-field">
      <button type="button" className="pe-color-swatch" title={label} aria-label={label}
        style={{ background: value }} onClick={() => ref.current?.click()}>
        <input ref={ref} type="color" value={value} onChange={e => { onChange(e.target.value); setDraft(e.target.value); }}
          style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }} tabIndex={-1} />
      </button>
      <input
        type="text"
        className="pe-color-input"
        value={draft}
        aria-label={`${label} hex`}
        spellCheck={false}
        maxLength={7}
        onChange={e => setDraft(e.target.value)}
        onBlur={e => commit(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') commit((e.target as HTMLInputElement).value); }}
      />
    </div>
  );
}

// ── bg + fg swatch pair ────────────────────────────────────────────
function ColorPair({ bg, fg, onBg, onFg }: { bg: string; fg: string; onBg: (v: string) => void; onFg: (v: string) => void }) {
  return (
    <div className="pe-color-pair">
      <ColorSwatch value={bg} onChange={onBg} label="สีพื้นหลัง" />
      <span className="pe-color-pair__preview" style={{ background: bg, color: fg }}>ตย.</span>
      <ColorSwatch value={fg} onChange={onFg} label="สีตัวอักษร" />
    </div>
  );
}

// ── Main modal ─────────────────────────────────────────────────────
export function PosterExportModal({ open, onClose, items, storeName, storeId, unit }: Props) {
  const logoKey   = `store-poster-logo:${storeId}`;
  const designKey = `store-poster-design:${storeId}`;

  const [exportLogo, setExportLogo] = useState('/avatars/store-duck.jpeg');
  const [imageBusy, setImageBusy]   = useState(false);
  const [imageError, setImageError] = useState('');

  useEffect(() => {
    try { setExportLogo(localStorage.getItem(logoKey) || '/avatars/store-duck.jpeg'); }
    catch { setExportLogo('/avatars/store-duck.jpeg'); }
  }, [logoKey]);

  const changeExportLogo = async (file?: File) => {
    if (!file) return;
    setImageError('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {
      setImageError('เลือกรูป JPG, PNG หรือ WebP ขนาดไม่เกิน 10 MB'); return;
    }
    setImageBusy(true);
    try {
      const blob = await toPngBlob(file, 512);
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      setExportLogo(data);
      try { localStorage.setItem(logoKey, data); }
      catch { setImageError('ใช้รูปนี้ได้ในครั้งนี้ แต่บันทึกไว้ในเบราว์เซอร์ไม่ได้'); }
    } catch { setImageError('อ่านรูปไม่ได้ กรุณาเลือกรูปใหม่'); }
    finally { setImageBusy(false); }
  };

  // ── Design state ──────────────────────────────────────────────────
  const [design, setDesignRaw] = useState<DesignSettings>(() => loadDesign(designKey));

  const setDesign = (patch: Partial<DesignSettings>) => {
    setDesignRaw(prev => {
      const next = { ...prev, ...patch };
      saveDesign(designKey, next);
      return next;
    });
  };

  const {
    footer, perPage, posterStyle, showStock, textAlign, imgSize, imgPosition,
    pillPosition, showBahtSymbol, priceColor, pillBg, pillFg,
    nameFontSize, priceFontSize, stockFontSize,
  } = design;
  const cols = Math.sqrt(perPage);
  const geometry = posterGeometry(cols, cols, !!footer.trim());

  const resetLayout = () => { setDesignRaw(DESIGN_DEFAULTS); saveDesign(designKey, DESIGN_DEFAULTS); };

  // ── Picker ────────────────────────────────────────────────────────
  const [generatedKey, setGeneratedKey] = useState('');
  const [pages, setPages]   = useState<Page[]>([]);
  const [busy, setBusy]     = useState(false);
  const [error, setError]   = useState('');
  const [query, setQuery]   = useState('');
  const [panel, setPanel] = useState('products');
  const [announcement, setAnnouncement] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      setSelected(new Set(items.map(i => i.name)));
      setQuery('');
      setDesignRaw(loadDesign(designKey));
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const chosen  = useMemo(() => items.filter(i => selected.has(i.name)), [items, selected]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? items.filter(i => i.name.toLowerCase().includes(q)) : items;
  }, [items, query]);

  // ── Ordered items for poster (drag-reorderable) ───────────────────
  // orderedNames tracks the full items list order (selected or not)
  const [orderedNames, setOrderedNames] = useState<string[]>([]);

  // Sync: keep existing order, append new items, drop deleted items
  useEffect(() => {
    setOrderedNames(prev => {
      const allNames = new Set(items.map(i => i.name));
      const kept  = prev.filter(n => allNames.has(n));
      const added = items.map(i => i.name).filter(n => !kept.includes(n));
      return [...kept, ...added];
    });
  }, [items]);

  // orderedItems = all items in drag order; orderedChosen = only selected ones (for render)
  const orderedItems = useMemo(
    () => orderedNames.map(n => items.find(i => i.name === n)).filter(Boolean) as typeof items,
    [orderedNames, items],
  );
  const orderedChosen = useMemo(
    () => orderedItems.filter(i => selected.has(i.name)),
    [orderedItems, selected],
  );

  // ── Drag state (preview grid) ─────────────────────────────────────
  const dragIdx = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const handleDragStart = useCallback((idx: number) => { dragIdx.current = idx; }, []);
  const handleDragEnter = useCallback((idx: number) => { setDragOver(idx); }, []);
  const moveItem = useCallback((from: number, to: number) => {
    setOrderedNames(prev => {
      if (from === to || from < 0 || to < 0 || to >= prev.length) return prev;
      const arr = [...prev];
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      setAnnouncement(`ย้าย ${moved} แล้ว`);
      return arr;
    });
  }, []);
  const clearDrag = () => { dragIdx.current = null; setDragOver(null); };
  const dropItem = (to: number) => {
    if (dragIdx.current !== null) moveItem(dragIdx.current, to);
    clearDrag();
  };

  const allVisibleOn  = visible.length > 0 && visible.every(i => selected.has(i.name));
  const someVisibleOn = visible.some(i => selected.has(i.name));
  const toggle     = (name: string) => setSelected(prev => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; });
  const setVisible = (on: boolean)  => setSelected(prev => { const n = new Set(prev); visible.forEach(i => on ? n.add(i.name) : n.delete(i.name)); return n; });

  const renderKey = JSON.stringify([
    orderedChosen, storeName, exportLogo, footer, unit, showStock, perPage, posterStyle,
    textAlign, imgSize, imgPosition, pillPosition, showBahtSymbol,
    priceColor, pillBg, pillFg, nameFontSize, priceFontSize, stockFontSize,
  ]);

  useEffect(() => {
    if (!open || !orderedChosen.length) { setPages([]); setBusy(false); return; }
    setBusy(true); setError(''); setPreviewIdx(null);
    let cancelled = false;
    const created: string[] = [];
    const timer = window.setTimeout(async () => {
      try {
        const canvases = await renderStorePosters(orderedChosen, {
          storeName, logo: exportLogo, footer, unit, showStock, cols, perPage,
          style: posterStyle, textAlign, imgSize, imgPosition, pillPosition,
          showBahtSymbol, priceColor, pillBg, pillFg,
          nameFontSize: nameFontSize || undefined,
          priceFontSize: priceFontSize || undefined,
          stockFontSize: stockFontSize || undefined,
        });
        const next: Page[] = [];
        for (const c of canvases) {
          const blob = await toBlob(c);
          if (cancelled) break;
          const url = URL.createObjectURL(blob);
          created.push(url);
          next.push({ url, blob });
        }
        if (!cancelled) { setPages(next); setGeneratedKey(renderKey); }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error && e.name !== 'SecurityError' ? e.message : 'สร้างรูปไม่สำเร็จ');
      } finally { if (!cancelled) setBusy(false); }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); created.forEach(u => URL.revokeObjectURL(u)); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, renderKey]);

  const fileName    = (i: number) => `${storeName || 'store'}-พร้อมขาย${pages.length > 1 ? `-${i + 1}` : ''}.png`;
  const download    = (i: number) => { if (!ready || !pages[i]) return; const a = document.createElement('a'); a.href = pages[i].url; a.download = fileName(i); a.click(); };
  const downloadAll = async () => { for (let i = 0; i < pages.length; i++) { download(i); await new Promise(r => setTimeout(r, 300)); } };
  const files    = pages.map((p, i) => new File([p.blob], fileName(i), { type: 'image/png' }));
  const canShare = typeof navigator !== 'undefined' && !!navigator.canShare && files.length > 0 && navigator.canShare({ files });
  const share    = async () => { if (!ready) return; try { await navigator.share({ files, title: storeName }); } catch { /* cancelled */ } };
  const ready    = generatedKey === renderKey && !error && !busy && !imageBusy && pages.length > 0 && orderedChosen.length > 0;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={<div className="pe-heading">สร้างรูปสินค้าพร้อมขาย<small>เลือกสินค้า จัดวาง แล้วดาวน์โหลดไปโพสต์ได้เลย</small></div>}
      width="min(96vw, 1080px)"
      style={{ top: 16 }}
      className="shop-poster-modal"
      styles={{ body: { padding: '0 0 4px', overflow: 'hidden' } }}
      footer={
        <div className="pe-footer">
          <span className="shop-muted">
            {orderedChosen.length
              ? `เลือก ${orderedChosen.length} รายการ · ${Math.ceil(orderedChosen.length / perPage)} รูป`
              : 'ยังไม่ได้เลือกสินค้า'}
          </span>
          <div className="pe-footer-actions">
            {canShare && <Button icon={<ShareAltOutlined />} disabled={!ready} onClick={() => void share()}>แชร์</Button>}
            <Button type="primary" icon={<DownloadOutlined />} loading={busy} disabled={!ready} onClick={() => void downloadAll()}>
              ดาวน์โหลด{orderedChosen.length ? ` ${Math.ceil(orderedChosen.length / perPage)} รูป` : ''}
            </Button>
          </div>
        </div>
      }
    >
      <div className="pe-layout">

        <aside className="pe-sidebar">
          <Segmented block className="pe-panel-tabs" aria-label="เครื่องมือสร้างรูป" value={panel} onChange={v => setPanel(String(v))}
            options={[{ label: 'เลือกสินค้า', value: 'products' }, { label: 'ปรับแต่ง', value: 'design' }]} />
        <div className="pe-picker" hidden={panel !== 'products'}>
          <div className="pe-picker__head">
            <strong>สินค้า</strong>
            <span className="shop-muted" style={{ fontSize: 12 }}>{chosen.length}/{items.length}</span>
          </div>
          <Input prefix={<SearchOutlined />} aria-label="ค้นหาสินค้า" placeholder="ค้นหาชื่อสินค้า…" allowClear size="small"
            value={query} onChange={e => setQuery(e.target.value)} style={{ margin: '6px 0' }} />
          <div className="pe-picker__bulk">
            <Checkbox checked={allVisibleOn} indeterminate={!allVisibleOn && someVisibleOn}
              disabled={!visible.length} onChange={e => setVisible(e.target.checked)}>
              {query ? 'ทั้งหมดที่ค้นเจอ' : 'เลือกทั้งหมด'}
            </Checkbox>
            {selected.size > 0 && <Button size="small" type="link" onClick={() => setSelected(new Set())}>ล้าง</Button>}
          </div>
          <ul className="pe-picker__list">
            {orderedItems.filter(item => visible.some(match => match.name === item.name)).map(item => {
              const on = selected.has(item.name);
              const globalIdx = orderedNames.indexOf(item.name);
              const isOver = dragOver === globalIdx;
              return (
                <li
                  key={item.name}
                  className={`pe-picker__row${on ? ' is-on' : ''}${isOver ? ' is-drag-over' : ''}`}
                  onClick={() => toggle(item.name)}
                  draggable
                  onDragStart={e => {
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', item.name);
                    handleDragStart(globalIdx);
                  }}
                  onDragEnter={e => { e.preventDefault(); handleDragEnter(globalIdx); }}
                  onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                  onDrop={e => { e.preventDefault(); dropItem(globalIdx); }}
                  onDragEnd={clearDrag}
                >
                  <span className="pe-drag-handle" aria-hidden="true" title="ลากเพื่อจัดลำดับ" onClick={e => e.stopPropagation()}>⠿</span>
                  <Checkbox aria-label={item.name} checked={on} onClick={e => e.stopPropagation()} onChange={() => toggle(item.name)} />
                  <span className="pe-picker__thumb">
                    {item.image ? <img src={item.image} alt="" loading="lazy" draggable={false} /> : <InboxOutlined />}
                  </span>
                  <span className="pe-picker__meta">
                    <span>{item.name}</span>
                    <small>{money(item.price)} · {item.stock.toLocaleString('th-TH')} {unit}</small>
                  </span>
                </li>
              );
            })}
            {!visible.length && query.trim() && <li className="pe-picker__empty">ไม่พบสินค้า</li>}
          </ul>
        </div>

        {/* ── Col 2: settings ──────────────────────────────────── */}
        <div className="pe-settings" hidden={panel !== 'design'}>

          {/* Logo */}
          <div className="pe-logo">
            <label className="pe-logo__upload">
              <img src={exportLogo} alt="โลโก้" className="pe-logo__img" />
              <div className="pe-logo__overlay">{imageBusy ? '…' : '✎'}</div>
              <input type="file" accept="image/jpeg,image/png,image/webp" disabled={imageBusy}
                onChange={e => { void changeExportLogo(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
            <div className="pe-logo__info">
              <span>รูปโลโก้</span>
              <small className="shop-muted">แยกจากโปรไฟล์ร้าน</small>
            </div>
          </div>
          {imageError && <Alert type="warning" showIcon message={imageError} style={{ fontSize: 12 }} />}

          <Divider style={{ margin: '6px 0' }} />

          <SettingRow label="ข้อความติดต่อ">
            <Input value={footer} onChange={e => setDesign({ footer: e.target.value })}
              maxLength={60} size="small" placeholder="เช่น FB: ชื่อเพจ" />
          </SettingRow>

          <SettingRow label="สินค้าต่อรูป">
            <Segmented value={perPage} onChange={v => setDesign({ perPage: Number(v) as 4 | 9 | 16 })}
              options={[{ value: 4, label: '4' }, { value: 9, label: '9' }, { value: 16, label: '16' }]} size="small" />
          </SettingRow>

          <SettingRow label="สไตล์">
            <Segmented value={posterStyle} onChange={v => setDesign({ posterStyle: v as PosterStyle })}
              options={STYLE_OPTIONS} size="small" />
          </SettingRow>

          <details className="pe-advanced">
          <summary>ปรับแต่งเพิ่มเติม</summary>
          <SettingRow label="ตำแหน่งข้อความ">
            <Segmented size="small" value={textAlign} onChange={v => setDesign({ textAlign: v as typeof textAlign })}
              options={[{ value: 'left', label: 'ซ้าย' }, { value: 'center', label: 'กลาง' }, { value: 'right', label: 'ขวา' }]} />
          </SettingRow>

          <SettingRow label="ขนาดรูปสินค้า">
            <Segmented size="small" value={imgSize} onChange={v => setDesign({ imgSize: v as typeof imgSize })}
              options={[{ value: 'xs', label: 'XS' }, { value: 'small', label: 'S' }, { value: 'medium', label: 'M' }, { value: 'large', label: 'L' }]} />
          </SettingRow>

          <SettingRow label="ตำแหน่งรูป">
            <Segmented size="small" value={imgPosition} onChange={v => setDesign({ imgPosition: v as typeof imgPosition })}
              options={[{ value: 'top', label: 'บน' }, { value: 'center', label: 'กลาง' }, { value: 'bottom', label: 'ล่าง' }]} />
          </SettingRow>

          <SettingRow label="แท็กกอง">
            <Segmented size="small" value={pillPosition} onChange={v => setDesign({ pillPosition: v as typeof pillPosition })}
              options={[{ value: 'left', label: 'ซ้าย' }, { value: 'right', label: 'ขวา' }, { value: 'inline', label: 'ข้างราคา' }]} />
          </SettingRow>

          <Divider style={{ margin: '6px 0' }} />

          {/* Font sizes — hidden until rendering bug is fixed */}
          {/* <FontSizeRow label="ชื่อสินค้า" value={nameFontSize}  onChange={v => setDesign({ nameFontSize: v })} />
          <FontSizeRow label="ราคา"       value={priceFontSize} onChange={v => setDesign({ priceFontSize: v })} />
          <FontSizeRow label="จำนวนกอง"   value={stockFontSize} onChange={v => setDesign({ stockFontSize: v })} />
          <Divider style={{ margin: '6px 0' }} /> */}

          {/* Colors */}
          <SettingRow label="สีราคา">
            <div className="pe-color-single">
              <ColorSwatch value={priceColor} onChange={v => setDesign({ priceColor: v })} label="สีตัวเลขราคา" />
              <span className="pe-color-preview" style={{ color: priceColor }}>฿999</span>
            </div>
          </SettingRow>

          <SettingRow label="สีแท็กกอง">
            <ColorPair bg={pillBg} fg={pillFg}
              onBg={v => setDesign({ pillBg: v })}
              onFg={v => setDesign({ pillFg: v })} />
          </SettingRow>

          <Divider style={{ margin: '6px 0' }} />

          {/* Checkboxes — no more giant switch */}
          <div className="pe-checks">
            <ToggleRow label="แสดงจำนวนคงเหลือ" checked={showStock}      onChange={v => setDesign({ showStock: v })} />
            <ToggleRow label="แสดงสัญลักษณ์ ฿"  checked={showBahtSymbol} onChange={v => setDesign({ showBahtSymbol: v })} />
          </div>

          </details>
          <Button size="small" onClick={resetLayout} style={{ marginTop: 8, width: '100%' }}>คืนค่าเริ่มต้น</Button>
          <p className="pe-note shop-muted">{geometry.width} × {geometry.height} px · บันทึกอัตโนมัติ</p>
        </div>

        </aside>
        <div className="pe-preview">
          <span className="pe-sr-only" role="status">{announcement}</span>
          {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 8 }} />}
          {!orderedChosen.length
            ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="ยังไม่ได้เลือกสินค้า" style={{ padding: '48px 0' }} />
            : busy && !pages.length
              ? <div className="shop-center"><Spin /></div>
              : <div className={`pe-pages${pages.length === 1 ? ' pe-pages--single' : ''}${busy ? ' is-busy' : ''}`}>
                  {pages.map((p, i) => (
                    <figure key={i} className="pe-page-fig">
                      <div className="pe-page-img">
                        <img src={p.url} alt={`รูปที่ ${i + 1}`} />
                        {ready && <div className="pe-reorder-grid" style={{ left: `${geometry.gridLeft / geometry.width * 100}%`, right: `${geometry.gridLeft / geometry.width * 100}%`, top: `${geometry.gridTop / geometry.height * 100}%`, bottom: 'auto', height: `${geometry.gridHeight / geometry.height * 100}%`, gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${cols}, 1fr)` }}>
                          {orderedChosen.slice(i * perPage, (i + 1) * perPage).map((item, localIdx) => {
                            const idx = orderedNames.indexOf(item.name);
                            const selectedIdx = i * perPage + localIdx;
                            return <button key={item.name} type="button" draggable
                              className={`pe-reorder-cell${dragOver === idx ? ' is-over' : ''}`}
                              aria-label={`${item.name} ลำดับ ${selectedIdx + 1} ใช้ปุ่มลูกศรเพื่อย้าย`}
                              onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', item.name); handleDragStart(idx); }}
                              onDragEnter={() => handleDragEnter(idx)} onDragOver={e => e.preventDefault()}
                              onDrop={e => { e.preventDefault(); dropItem(idx); }} onDragEnd={clearDrag}
                              onKeyDown={e => {
                                const offset = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols } as Record<string, number>)[e.key];
                                if (offset === undefined) return;
                                e.preventDefault();
                                const target = orderedChosen[selectedIdx + offset];
                                if (target) moveItem(idx, orderedNames.indexOf(target.name));
                              }} />;
                          })}
                        </div>}
                        <button type="button" className="pe-page-expand pe-page-download" disabled={!ready}
                          onClick={() => download(i)} aria-label={`ดาวน์โหลดรูปที่ ${i + 1}`} title="ดาวน์โหลดรูปนี้">
                          <DownloadOutlined />
                        </button>
                        <button className="pe-page-expand" onClick={() => setPreviewIdx(i)} aria-label="ดูขนาดเต็ม">
                          <ExpandOutlined />
                        </button>
                      </div>
                    </figure>
                  ))}
                </div>}
        </div>

      </div>

      {/* Full-size preview */}
      <Modal
        open={previewIdx !== null}
        onCancel={() => setPreviewIdx(null)}
        footer={previewIdx !== null ? (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            {canShare && <Button icon={<ShareAltOutlined />} onClick={() => void share()}>แชร์</Button>}
            <Button disabled={!ready} type="primary" icon={<DownloadOutlined />}
              onClick={() => { if (previewIdx !== null) download(previewIdx); }}>บันทึกรูป</Button>
          </div>
        ) : null}
        width="min(90vw, 720px)"
        style={{ top: 16 }}
        title={previewIdx !== null && pages.length > 1 ? `รูปที่ ${previewIdx + 1}` : 'พรีวิวรูป'}
        styles={{ body: { padding: 0, overflow: 'hidden', borderRadius: 8 } }}
      >
        {previewIdx !== null && pages[previewIdx] && (
          <img src={pages[previewIdx].url} alt="พรีวิว" style={{ display: 'block', width: '100%', height: 'auto' }} />
        )}
      </Modal>
    </Modal>
  );
}

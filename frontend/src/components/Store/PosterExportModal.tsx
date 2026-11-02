import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Checkbox, Input, InputNumber, Modal, Segmented, Spin, Switch, Empty } from 'antd';
import { DownloadOutlined, InboxOutlined, SearchOutlined, ShareAltOutlined } from '@ant-design/icons';
import { toPngBlob } from './profileImage';
import { renderStorePosters, type PosterItem, type PosterStyle } from './storePoster';

type Props = { open: boolean; onClose: () => void; items: PosterItem[]; storeName: string; storeId: string; unit: string };
type Page = { url: string; blob: Blob };

const toBlob = (c: HTMLCanvasElement) => new Promise<Blob>((resolve, reject) =>
  c.toBlob(b => b ? resolve(b) : reject(new Error('สร้างรูปไม่สำเร็จ')), 'image/png'));
const money = (n: number) => `฿${new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 }).format(n)}`;

const STYLE_OPTIONS: { value: PosterStyle; label: string }[] = [
  { value: 'card',    label: 'การ์ด' },
  { value: 'soft',    label: 'นุ่ม' },
  { value: 'minimal', label: 'มินิมอล' },
];


export function PosterExportModal({ open, onClose, items, storeName, storeId, unit }: Props) {
  const storageKey = `store-poster-logo:${storeId}`;
  const [exportLogo, setExportLogo] = useState('/avatars/store-duck.jpeg');
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState('');

  useEffect(() => {
    try { setExportLogo(localStorage.getItem(storageKey) || '/avatars/store-duck.jpeg'); }
    catch { setExportLogo('/avatars/store-duck.jpeg'); }
  }, [storageKey]);

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
      try { localStorage.setItem(storageKey, data); }
      catch { setImageError('ใช้รูปนี้ได้ในครั้งนี้ แต่บันทึกไว้ในเบราว์เซอร์ไม่ได้'); }
    } catch { setImageError('อ่านรูปไม่ได้ กรุณาเลือกรูปใหม่'); }
    finally { setImageBusy(false); }
  };

  const [footer, setFooter] = useState('FB: เป็ด ก๊าบ กั๊บ ก๊าบบ');
  const [cols, setCols]   = useState<number>(4);
  const [posterStyle, setPosterStyle] = useState<PosterStyle>('card');
  const [showStock, setShowStock] = useState(true);
  const [pages, setPages] = useState<Page[]>([]);
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pickerOpen, setPickerOpen] = useState(true);

  useEffect(() => {
    if (open) { setSelected(new Set(items.map(i => i.name))); setQuery(''); setPickerOpen(true); }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const chosen  = useMemo(() => items.filter(i => selected.has(i.name)), [items, selected]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? items.filter(i => i.name.toLowerCase().includes(q)) : items;
  }, [items, query]);

  const allVisibleOn  = visible.length > 0 && visible.every(i => selected.has(i.name));
  const someVisibleOn = visible.some(i => selected.has(i.name));
  const toggle     = (name: string) => setSelected(prev => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; });
  const setVisible = (on: boolean)  => setSelected(prev => { const n = new Set(prev); visible.forEach(i => on ? n.add(i.name) : n.delete(i.name)); return n; });

  useEffect(() => {
    if (!open || !chosen.length) { setPages([]); setBusy(false); return; }
    let cancelled = false;
    const created: string[] = [];
    const timer = window.setTimeout(async () => {
      setBusy(true); setError('');
      try {
        const canvases = await renderStorePosters(chosen, { storeName, logo: exportLogo, footer, unit, showStock, cols, style: posterStyle });
        const next: Page[] = [];
        for (const c of canvases) {
          const blob = await toBlob(c);
          const url  = URL.createObjectURL(blob);
          created.push(url);
          next.push({ url, blob });
        }
        if (!cancelled) setPages(next);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error && e.name !== 'SecurityError' ? e.message : 'สร้างรูปไม่สำเร็จ');
      } finally { if (!cancelled) setBusy(false); }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); created.forEach(u => URL.revokeObjectURL(u)); };
  }, [open, chosen, storeName, exportLogo, footer, unit, showStock, cols, posterStyle]);

  const fileName   = (i: number) => `${storeName || 'store'}-พร้อมขาย${pages.length > 1 ? `-${i + 1}` : ''}.png`;
  const download   = (i: number) => { const a = document.createElement('a'); a.href = pages[i].url; a.download = fileName(i); a.click(); };
  const downloadAll = async () => { for (let i = 0; i < pages.length; i++) { download(i); await new Promise(r => setTimeout(r, 300)); } };
  const files    = pages.map((p, i) => new File([p.blob], fileName(i), { type: 'image/png' }));
  const canShare = typeof navigator !== 'undefined' && !!navigator.canShare && files.length > 0 && navigator.canShare({ files });
  const share    = async () => { try { await navigator.share({ files, title: storeName }); } catch { /* cancelled */ } };
  const ready    = !busy && !imageBusy && pages.length > 0 && chosen.length > 0;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title="ส่งออกรูปสินค้าพร้อมขาย"
      width={820}
      className="shop-poster-modal"
      footer={
        <div className="shop-poster__footer">
          <span className="shop-muted">
            {chosen.length ? `เลือก ${chosen.length} รายการ · ${Math.ceil(chosen.length / cols)} แถว` : 'ยังไม่ได้เลือกสินค้า'}
          </span>
          <div>
            {canShare && <Button icon={<ShareAltOutlined />} disabled={!ready} onClick={() => void share()}>แชร์</Button>}
            <Button type="primary" icon={<DownloadOutlined />} disabled={!ready} onClick={() => void downloadAll()}>
              ดาวน์โหลดรูป
            </Button>
          </div>
        </div>
      }
    >
      <div className="pm-wrap">

        {/* ── Row 1: settings bar ───────────────────────────── */}
        <div className="pm-settings">
          {/* logo */}
          <div className="pm-logo-row">
            <img className="pm-logo-img" src={exportLogo} alt="โลโก้" />
            <label className="pm-logo-label">
              <span>รูปโลโก้</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" disabled={imageBusy}
                onChange={e => { void changeExportLogo(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
          </div>

          <div className="pm-divider" />

          {/* cols */}
          <div className="pm-field">
            <span className="pm-label">คอลัมน์</span>
            <InputNumber min={1} max={10} value={cols} size="small"
              onChange={v => setCols(Math.max(1, Math.min(10, Number(v) || 1)))}
              style={{ width: 64 }} />
          </div>

          <div className="pm-divider" />

          {/* style */}
          <div className="pm-field">
            <span className="pm-label">สไตล์</span>
            <Segmented value={posterStyle} onChange={v => setPosterStyle(v as PosterStyle)} options={STYLE_OPTIONS} size="small" />
          </div>

          <div className="pm-divider" />

          {/* stock toggle */}
          <div className="pm-field pm-field--inline">
            <span className="pm-label">คงเหลือ</span>
            <Switch size="small" checked={showStock} onChange={setShowStock} />
          </div>

          <div className="pm-divider" />

          {/* footer text */}
          <div className="pm-field pm-field--footer">
            <span className="pm-label">ข้อความล่าง</span>
            <Input size="small" value={footer} onChange={e => setFooter(e.target.value)} maxLength={60} placeholder="เว้นว่างได้" />
          </div>
        </div>

        {imageError && <Alert type="warning" showIcon message={imageError} style={{ marginBottom: 8 }} />}

        {/* ── Row 2: picker (collapsible) + preview side-by-side ── */}
        <div className="pm-body">

          {/* picker panel */}
          <div className={`pm-picker${pickerOpen ? '' : ' pm-picker--closed'}`}>
            <div className="pm-picker__head" onClick={() => setPickerOpen(v => !v)}>
              <strong>สินค้า</strong>
              <span className="shop-muted">{chosen.length}/{items.length}</span>
              <span className="pm-chevron">{pickerOpen ? '▲' : '▼'}</span>
            </div>
            {pickerOpen && <>
              <Input prefix={<SearchOutlined />} placeholder="ค้นหา" allowClear size="small"
                value={query} onChange={e => setQuery(e.target.value)} style={{ margin: '6px 0' }} />
              <div className="pm-picker__bulk">
                <Checkbox checked={allVisibleOn} indeterminate={!allVisibleOn && someVisibleOn}
                  disabled={!visible.length} onChange={e => setVisible(e.target.checked)}>
                  {query ? 'เลือกทั้งหมดที่ค้นเจอ' : 'เลือกทั้งหมด'}
                </Checkbox>
                {selected.size > 0 && <Button size="small" type="link" onClick={() => setSelected(new Set())}>ล้าง</Button>}
              </div>
              <ul className="pm-picker__list">
                {visible.map(item => {
                  const on = selected.has(item.name);
                  return (
                    <li key={item.name}
                      className={`pm-picker__row${on ? ' is-on' : ''}`}
                      onClick={() => toggle(item.name)}>
                      <Checkbox checked={on} onClick={e => e.stopPropagation()} onChange={() => toggle(item.name)} />
                      <span className="pm-picker__thumb">
                        {item.image ? <img src={item.image} alt="" loading="lazy" /> : <InboxOutlined />}
                      </span>
                      <span className="pm-picker__meta">
                        <span>{item.name}</span>
                        <small>{money(item.price)} · {item.stock.toLocaleString('th-TH')} {unit}</small>
                      </span>
                    </li>
                  );
                })}
                {!visible.length && <li className="pm-picker__empty">ไม่พบสินค้า</li>}
              </ul>
            </>}
          </div>

          {/* preview panel */}
          <div className="pm-preview">
            {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 8 }} />}
            {!chosen.length
              ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="เลือกสินค้าทางซ้ายอย่างน้อย 1 รายการ" style={{ padding: '48px 0' }} />
              : busy && !pages.length
                ? <div className="shop-center"><Spin /></div>
                : <div className={`pm-preview__pages${busy ? ' is-busy' : ''}`}>
                    {pages.map((p, i) => (
                      <figure key={p.url} className="pm-preview__figure">
                        <img src={p.url} alt={`รูปที่ ${i + 1}`} />
                        {pages.length > 1 &&
                          <figcaption>
                            <span>รูปที่ {i + 1}</span>
                            <Button size="small" type="link" icon={<DownloadOutlined />} onClick={() => download(i)}>ดาวน์โหลด</Button>
                          </figcaption>}
                      </figure>
                    ))}
                  </div>}
          </div>

        </div>
      </div>
    </Modal>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Checkbox, Input, Modal, Segmented, Spin, Switch, Empty } from 'antd';
import { DownloadOutlined, InboxOutlined, SearchOutlined, ShareAltOutlined, ExpandOutlined } from '@ant-design/icons';
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
  const [perPage, setPerPage] = useState<4 | 9 | 16>(4);
  const cols = Math.sqrt(perPage);
  const [advanced, setAdvanced] = useState(false);
  const [generatedKey, setGeneratedKey] = useState('');
  const [posterStyle, setPosterStyle] = useState<PosterStyle>('card');
  const [showStock, setShowStock] = useState(true);
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('center');
  const [imgSize, setImgSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [imgPosition, setImgPosition] = useState<'top' | 'center' | 'bottom'>('center');
  const [imgRatio, setImgRatio] = useState<'1:1' | '4:5' | '3:4'>('1:1');
  const [pillPosition, setPillPosition] = useState<'right' | 'left' | 'inline'>('right');
  const [showBahtSymbol, setShowBahtSymbol] = useState(true);
  const [pages, setPages] = useState<Page[]>([]);
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pickerOpen, setPickerOpen] = useState(true);
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);

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

  const renderKey = JSON.stringify([chosen, storeName, exportLogo, footer, unit, showStock, perPage, posterStyle, textAlign, imgSize, imgPosition, imgRatio, pillPosition, showBahtSymbol]);
  const resetLayout = () => {
    setPerPage(4); setPosterStyle('card'); setShowStock(true); setTextAlign('center');
    setImgSize('medium'); setImgPosition('center'); setImgRatio('1:1'); setPillPosition('right'); setShowBahtSymbol(true);
  };
  useEffect(() => {
    if (!open || !chosen.length) { setPages([]); setBusy(false); return; }
    setBusy(true); setError(''); setPreviewIdx(null);
    let cancelled = false;
    const created: string[] = [];
    const timer = window.setTimeout(async () => {
      setBusy(true); setError('');
      try {
        const canvases = await renderStorePosters(chosen, { storeName, logo: exportLogo, footer, unit, showStock, cols, perPage, style: posterStyle, textAlign, imgSize, imgPosition, imgRatio, pillPosition, showBahtSymbol });
        const next: Page[] = [];
        for (const c of canvases) {
          const blob = await toBlob(c);
          if (cancelled) break;
          const url  = URL.createObjectURL(blob);
          created.push(url);
          next.push({ url, blob });
        }
        if (!cancelled) { setPages(next); setGeneratedKey(renderKey); }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error && e.name !== 'SecurityError' ? e.message : 'สร้างรูปไม่สำเร็จ');
      } finally { if (!cancelled) setBusy(false); }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); created.forEach(u => URL.revokeObjectURL(u)); };
  }, [open, chosen, storeName, exportLogo, footer, unit, showStock, cols, posterStyle, textAlign, imgSize, imgPosition, imgRatio, pillPosition, showBahtSymbol, perPage, renderKey]);

  const fileName   = (i: number) => `${storeName || 'store'}-พร้อมขาย${pages.length > 1 ? `-${i + 1}` : ''}.png`;
  const download   = (i: number) => { if (!ready || !pages[i]) return; const a = document.createElement('a'); a.href = pages[i].url; a.download = fileName(i); a.click(); };
  const downloadAll = async () => { for (let i = 0; i < pages.length; i++) { download(i); await new Promise(r => setTimeout(r, 300)); } };
  const files    = pages.map((p, i) => new File([p.blob], fileName(i), { type: 'image/png' }));
  const canShare = typeof navigator !== 'undefined' && !!navigator.canShare && files.length > 0 && navigator.canShare({ files });
  const share    = async () => { if (!ready) return; try { await navigator.share({ files, title: storeName }); } catch { /* cancelled */ } };
  const ready    = generatedKey === renderKey && !error && !busy && !imageBusy && pages.length > 0 && chosen.length > 0;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title="ส่งออกรูปสินค้าพร้อมขาย"
      width="92vw"
      style={{ top: 24, maxWidth: 1200 }}
      className="shop-poster-modal"
      styles={{ body: { overflowY: 'auto', maxHeight: 'calc(90vh - 110px)', padding: '4px 24px 8px' } }}
      footer={
        <div className="shop-poster__footer">
          <span className="shop-muted">
            {chosen.length ? `เลือก ${chosen.length} รายการ · ${Math.ceil(chosen.length / perPage)} รูป` : 'ยังไม่ได้เลือกสินค้า'}
          </span>
          <div>
            {canShare && <Button icon={<ShareAltOutlined />} disabled={!ready} onClick={() => void share()}>แชร์</Button>}
            <Button type="primary" icon={<DownloadOutlined />} disabled={!ready} onClick={() => void downloadAll()}>
              {busy || generatedKey !== renderKey ? 'กำลังสร้างภาพ…' : `ดาวน์โหลด ${pages.length} รูป`}
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
              <span>รูปสำหรับโพสต์</span><small>แยกจากโปรไฟล์ร้าน · จำไว้ในเบราว์เซอร์นี้</small>
              <input type="file" accept="image/jpeg,image/png,image/webp" disabled={imageBusy}
                onChange={e => { void changeExportLogo(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
          </div>

          <div className="pm-divider" />

          <div className="pm-field">
            <span className="pm-label">สินค้าต่อภาพ</span>
            <Segmented aria-label="สินค้าต่อภาพ" value={perPage} onChange={v => setPerPage(Number(v) as 4 | 9 | 16)} options={[4, 9, 16]} />
          </div>
          <div className="pm-field pm-field--footer">
            <label htmlFor="poster-footer">ข้อความติดต่อ</label>
            <Input id="poster-footer" value={footer} onChange={e => setFooter(e.target.value)} maxLength={60} />
          </div>
          <Button aria-expanded={advanced} onClick={() => setAdvanced(v => !v)}>ปรับแต่งเพิ่มเติม</Button>
        </div>
        {advanced && <div className="pm-settings pm-advanced">
          <Button onClick={resetLayout}>คืนค่าเริ่มต้น</Button>
          {/* style */}
          <div className="pm-field">
            <span className="pm-label">สไตล์</span>
            <Segmented aria-label="สไตล์ภาพ" value={posterStyle} onChange={v => setPosterStyle(v as PosterStyle)} options={STYLE_OPTIONS} size="small" />
          </div>

          <div className="pm-divider" />

          {/* stock toggle */}
          <div className="pm-field pm-field--inline">
            <span className="pm-label">คงเหลือ</span>
            <Switch aria-label="แสดงจำนวนคงเหลือ" size="small" checked={showStock} onChange={setShowStock} />
          </div>

          <div className="pm-divider" />

          {/* text align */}
          <div className="pm-field">
            <span className="pm-label">ตำแหน่งข้อความ</span>
            <Segmented aria-label="ตำแหน่งข้อความ" size="small" value={textAlign} onChange={v => setTextAlign(v as typeof textAlign)}
              options={[{ value: 'left', label: 'ซ้าย' }, { value: 'center', label: 'กลาง' }, { value: 'right', label: 'ขวา' }]} />
          </div>

          <div className="pm-divider" />

          {/* image size */}
          <div className="pm-field">
            <span className="pm-label">ขนาดรูป</span>
            <Segmented aria-label="ขนาดรูป" size="small" value={imgSize} onChange={v => setImgSize(v as typeof imgSize)}
              options={[{ value: 'small', label: 'S' }, { value: 'medium', label: 'M' }, { value: 'large', label: 'L' }]} />
          </div>

          <div className="pm-divider" />

          {/* image ratio */}
          <div className="pm-field">
            <span className="pm-label">สัดส่วนกรอบรูป</span>
            <Segmented aria-label="สัดส่วนรูป" size="small" value={imgRatio} onChange={v => setImgRatio(v as typeof imgRatio)}
              options={[{ value: '1:1', label: '1:1' }, { value: '4:5', label: '4:5' }, { value: '3:4', label: '3:4' }]} />
          </div>

          <div className="pm-divider" />

          {/* image position */}
          <div className="pm-field">
            <span className="pm-label">ตำแหน่งรูป</span>
            <Segmented aria-label="ตำแหน่งรูป" size="small" value={imgPosition} onChange={v => setImgPosition(v as typeof imgPosition)}
              options={[{ value: 'top', label: 'บน' }, { value: 'center', label: 'กลาง' }, { value: 'bottom', label: 'ล่าง' }]} />
          </div>

          <div className="pm-divider" />

          {/* pill position */}
          <div className="pm-field">
            <span className="pm-label">แท็กกอง</span>
            <Segmented aria-label="ตำแหน่งจำนวน" size="small" value={pillPosition} onChange={v => setPillPosition(v as typeof pillPosition)}
              options={[{ value: 'left', label: 'ซ้าย' }, { value: 'right', label: 'ขวา' }, { value: 'inline', label: 'ข้างราคา' }]} />
          </div>

          <div className="pm-divider" />

          {/* baht symbol */}
          <div className="pm-field pm-field--inline">
            <span className="pm-label">แสดง ฿</span>
            <Switch aria-label="แสดงสัญลักษณ์บาท" size="small" checked={showBahtSymbol} onChange={setShowBahtSymbol} />
          </div>

          <div className="pm-divider" />

        </div>}
        <p className="shop-muted" role="status" aria-live="polite">{busy ? 'กำลังสร้างภาพ…' : '1080 × 1350 px · แบ่งหลายภาพอัตโนมัติ'}</p>

        {imageError && <Alert type="warning" showIcon message={imageError} style={{ marginBottom: 8 }} />}

        {/* ── Row 2: picker (collapsible) + preview side-by-side ── */}
        <div className="pm-body">

          {/* picker panel */}
          <div className={`pm-picker${pickerOpen ? '' : ' pm-picker--closed'}`}>
            <button type="button" aria-expanded={pickerOpen} className="pm-picker__head" onClick={() => setPickerOpen(v => !v)}>
              <strong>สินค้า</strong>
              <span className="shop-muted">{chosen.length}/{items.length}</span>
              <span className="pm-chevron">{pickerOpen ? '▲' : '▼'}</span>
            </button>
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
                      <Checkbox aria-label={item.name} checked={on} onClick={e => e.stopPropagation()} onChange={() => toggle(item.name)} />
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
                        <div className="pm-preview__img-wrap">
                          <img src={p.url} alt={`รูปที่ ${i + 1}`} />
                          <button
                            className="pm-preview__expand"
                            onClick={() => setPreviewIdx(i)}
                            aria-label="ดูขนาดเต็ม"
                          >
                            <ExpandOutlined />
                          </button>
                        </div>
                        <figcaption>
                          <span className="shop-muted" style={{ fontSize: 12 }}>รูปที่ {i + 1}</span>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <Button size="small" icon={<ExpandOutlined />} onClick={() => setPreviewIdx(i)}>ดู</Button>
                            <Button disabled={!ready} size="small" type="primary" icon={<DownloadOutlined />} onClick={() => download(i)}>บันทึก</Button>
                          </div>
                        </figcaption>
                      </figure>
                    ))}
                  </div>}
          </div>

        </div>
      </div>

      {/* Full-size preview modal */}
      <Modal
        open={previewIdx !== null}
        onCancel={() => setPreviewIdx(null)}
        footer={previewIdx !== null ? (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            {canShare && <Button icon={<ShareAltOutlined />} onClick={() => void share()}>แชร์</Button>}
            <Button disabled={!ready} type="primary" icon={<DownloadOutlined />} onClick={() => { if (previewIdx !== null) download(previewIdx); }}>บันทึกรูป</Button>
          </div>
        ) : null}
        width="min(90vw, 800px)"
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

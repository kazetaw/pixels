import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Checkbox, Empty, Input, Modal, Segmented, Spin, Switch } from 'antd';
import { DownloadOutlined, InboxOutlined, SearchOutlined, ShareAltOutlined } from '@ant-design/icons';
import { toPngBlob } from './profileImage';
import { renderStorePosters, type PosterItem } from './storePoster';

type Props = { open: boolean; onClose: () => void; items: PosterItem[]; storeName: string; storeId: string; unit: string };
type Page = { url: string; blob: Blob };

const toBlob = (c: HTMLCanvasElement) => new Promise<Blob>((resolve, reject) => c.toBlob(b => b ? resolve(b) : reject(new Error('สร้างรูปไม่สำเร็จ')), 'image/png'));
const money = (n: number) => `฿${new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 }).format(n)}`;

/** Pick products, preview and download/share square "ready to sell" posters. */
export function PosterExportModal({ open, onClose, items, storeName, storeId, unit }: Props) {
  const title = 'สินค้าพร้อมขาย';
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
        const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob);
      });
      setExportLogo(data);
      try { localStorage.setItem(storageKey, data); }
      catch { setImageError('ใช้รูปนี้ได้ในครั้งนี้ แต่บันทึกไว้ในเบราว์เซอร์ไม่ได้'); }
    } catch { setImageError('อ่านรูปไม่ได้ กรุณาเลือกรูปใหม่'); }
    finally { setImageBusy(false); }
  };
  const [footer, setFooter] = useState('FB: เป็ด ก๊าบ กั๊บ ก๊าบบ');
  const [perPage, setPerPage] = useState<number>(9);
  const [showStock, setShowStock] = useState(true);
  const [pages, setPages] = useState<Page[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Every time the dialog opens, start with everything selected.
  useEffect(() => { if (open) { setSelected(new Set(items.map(i => i.name))); setQuery(''); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const chosen = useMemo(() => items.filter(i => selected.has(i.name)), [items, selected]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? items.filter(i => i.name.toLowerCase().includes(q)) : items;
  }, [items, query]);
  const allVisibleOn = visible.length > 0 && visible.every(i => selected.has(i.name));
  const someVisibleOn = visible.some(i => selected.has(i.name));
  const toggle = (name: string) => setSelected(prev => { const next = new Set(prev); if (next.has(name)) next.delete(name); else next.add(name); return next; });
  const setVisible = (on: boolean) => setSelected(prev => { const next = new Set(prev); visible.forEach(i => on ? next.add(i.name) : next.delete(i.name)); return next; });

  useEffect(() => {
    if (!open || !chosen.length) { setPages([]); setBusy(false); return; }
    let cancelled = false;
    const created: string[] = [];
    const timer = window.setTimeout(async () => {
      setBusy(true); setError('');
      try {
        const canvases = await renderStorePosters(chosen, { storeName, logo: exportLogo, title, footer, unit, showStock, perPage });
        const next: Page[] = [];
        for (const c of canvases) { const blob = await toBlob(c); const url = URL.createObjectURL(blob); created.push(url); next.push({ url, blob }); }
        if (!cancelled) setPages(next);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error && e.name !== 'SecurityError' ? e.message : 'สร้างรูปไม่สำเร็จ (รูปสินค้าบางรูปโหลดไม่ได้)');
      } finally { if (!cancelled) setBusy(false); }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); created.forEach(u => URL.revokeObjectURL(u)); };
  }, [open, chosen, storeName, exportLogo, footer, unit, showStock, perPage]);

  const fileName = (i: number) => `${storeName || 'store'}-พร้อมขาย${pages.length > 1 ? `-${i + 1}` : ''}.png`;
  const download = (i: number) => { const a = document.createElement('a'); a.href = pages[i].url; a.download = fileName(i); a.click(); };
  const downloadAll = async () => { for (let i = 0; i < pages.length; i++) { download(i); await new Promise(r => setTimeout(r, 300)); } };
  const files = pages.map((p, i) => new File([p.blob], fileName(i), { type: 'image/png' }));
  const canShare = typeof navigator !== 'undefined' && !!navigator.canShare && files.length > 0 && navigator.canShare({ files });
  const share = async () => { try { await navigator.share({ files, title: `${storeName} · ${title}` }); } catch { /* cancelled */ } };
  const ready = !busy && !imageBusy && pages.length > 0 && chosen.length > 0;

  return (
    <Modal open={open} onCancel={onClose} title="ส่งออกรูปสินค้าพร้อมขาย" width={1000} className="shop-poster-modal" footer={
      <div className="shop-poster__footer">
        <span className="shop-muted">{chosen.length ? `เลือก ${chosen.length} รายการ · ${pages.length || Math.ceil(chosen.length / perPage)} รูป` : 'ยังไม่ได้เลือกสินค้า'}</span>
        <div>
          {canShare && <Button icon={<ShareAltOutlined />} disabled={!ready} onClick={() => void share()}>แชร์</Button>}
          <Button type="primary" icon={<DownloadOutlined />} disabled={!ready} onClick={() => void downloadAll()}>
            {pages.length > 1 ? `ดาวน์โหลด ${pages.length} รูป` : 'ดาวน์โหลดรูป'}
          </Button>
        </div>
      </div>
    }>
      <div className="shop-poster">
        {/* 1 · Pick products */}
        <section className="shop-poster__pick" aria-label="เลือกสินค้า">
          <header>
            <strong>1 · เลือกสินค้า</strong>
            <span className="shop-muted">{chosen.length}/{items.length}</span>
          </header>
          <Input prefix={<SearchOutlined className="shop-muted" />} placeholder="ค้นหาสินค้า" allowClear value={query} onChange={e => setQuery(e.target.value)} />
          <div className="shop-poster__bulk">
            <Checkbox checked={allVisibleOn} indeterminate={!allVisibleOn && someVisibleOn} disabled={!visible.length} onChange={e => setVisible(e.target.checked)}>
              {query ? 'เลือกทั้งหมดที่ค้นเจอ' : 'เลือกทั้งหมด'}
            </Checkbox>
            {selected.size > 0 && <Button size="small" type="link" onClick={() => setSelected(new Set())}>ล้าง</Button>}
          </div>
          <ul className="shop-poster__list">
            {visible.map(item => {
              const on = selected.has(item.name);
              return (
                <li key={item.name}>
                  <div className={`shop-poster__row${on ? ' is-on' : ''}`} onClick={() => toggle(item.name)}>
                    <Checkbox checked={on} aria-label={item.name} onClick={e => e.stopPropagation()} onChange={() => toggle(item.name)} />
                    <span className="shop-poster__thumb">{item.image ? <img src={item.image} alt="" loading="lazy" /> : <InboxOutlined />}</span>
                    <span className="shop-poster__meta">
                      <span>{item.name}</span>
                      <small>{money(item.price)} · {item.stock.toLocaleString('th-TH')} {unit}</small>
                    </span>
                  </div>
                </li>
              );
            })}
            {!visible.length && <li className="shop-poster__none">ไม่พบสินค้า</li>}
          </ul>
        </section>

        {/* 2 · Options + preview */}
        <section className="shop-poster__right" aria-label="ตัวอย่างรูป">
          <header><strong>2 · ตัวอย่างรูป</strong><span className="shop-muted">1080×1080</span></header>
          <div className="shop-poster__logo">
            <img src={exportLogo} alt="รูปสำหรับส่งออก" />
            <div>
              <label className="shop-field">รูปสำหรับส่งออก
                <input type="file" accept="image/jpeg,image/png,image/webp" disabled={imageBusy} onChange={e => { void changeExportLogo(e.target.files?.[0]); e.target.value = ''; }} />
              </label>
              <small className="shop-muted">แยกจากรูปโปรไฟล์ร้าน · จำรูปไว้ในเบราว์เซอร์นี้</small>
              {imageBusy && <span role="status"> กำลังเตรียมรูป…</span>}
            </div>
          </div>
          {imageError && <Alert type="warning" showIcon message={imageError} />}
          <div className="shop-poster__opts">
            <div className="shop-field">สินค้าต่อรูป
              <Segmented value={perPage} onChange={v => setPerPage(Number(v))} options={[{ value: 4, label: '4' }, { value: 9, label: '9' }, { value: 16, label: '16' }]} />
            </div>
            <label className="shop-field shop-poster__switch">แสดงคงเหลือ<Switch size="small" checked={showStock} onChange={setShowStock} /></label>
            <label className="shop-field shop-poster__footerText">ข้อความมุมขวาล่าง<Input value={footer} onChange={e => setFooter(e.target.value)} maxLength={60} placeholder="เว้นว่างได้" /></label>
          </div>
          {error && <Alert type="error" showIcon message={error} />}
          {!chosen.length
            ? <Empty className="shop-poster__empty" image={Empty.PRESENTED_IMAGE_SIMPLE} description="เลือกสินค้าทางซ้ายอย่างน้อย 1 รายการ" />
            : busy && !pages.length ? <div className="shop-center"><Spin /></div>
            : <div className={`shop-poster__pages${pages.length === 1 ? ' is-single' : ''}${busy ? ' is-busy' : ''}`}>
                {pages.map((p, i) => (
                  <figure key={p.url}>
                    <img src={p.url} alt={`รูปที่ ${i + 1}`} />
                    {pages.length > 1 && <figcaption><span>รูปที่ {i + 1}</span><Button size="small" type="link" icon={<DownloadOutlined />} onClick={() => download(i)}>ดาวน์โหลด</Button></figcaption>}
                  </figure>
                ))}
              </div>}
        </section>
      </div>
    </Modal>
  );
}

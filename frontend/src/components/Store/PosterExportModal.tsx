import { useEffect, useState } from 'react';
import { Alert, Button, Empty, Input, Modal, Segmented, Spin, Switch } from 'antd';
import { DownloadOutlined, ShareAltOutlined } from '@ant-design/icons';
import { renderStorePosters, type PosterItem } from './storePoster';

type Props = { open: boolean; onClose: () => void; items: PosterItem[]; storeName: string; logo: string | null; unit: string };
type Page = { url: string; blob: Blob };

const toBlob = (c: HTMLCanvasElement) => new Promise<Blob>((resolve, reject) => c.toBlob(b => b ? resolve(b) : reject(new Error('สร้างรูปไม่สำเร็จ')), 'image/png'));

/** Preview + download/share square "ready to sell" posters for social media. */
export function PosterExportModal({ open, onClose, items, storeName, logo, unit }: Props) {
  const title = 'สินค้าพร้อมขาย';
  const [footer, setFooter] = useState('สนใจทักแชทได้เลย');
  const [perPage, setPerPage] = useState<number>(9);
  const [showStock, setShowStock] = useState(true);
  const [pages, setPages] = useState<Page[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !items.length) { setPages([]); return; }
    let cancelled = false;
    const created: string[] = [];
    const timer = window.setTimeout(async () => {
      setBusy(true); setError('');
      try {
        const canvases = await renderStorePosters(items, { storeName, logo, title, footer, unit, showStock, perPage });
        const next: Page[] = [];
        for (const c of canvases) { const blob = await toBlob(c); const url = URL.createObjectURL(blob); created.push(url); next.push({ url, blob }); }
        if (!cancelled) setPages(next);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error && e.name !== 'SecurityError' ? e.message : 'สร้างรูปไม่สำเร็จ (รูปสินค้าบางรูปโหลดไม่ได้)');
      } finally { if (!cancelled) setBusy(false); }
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); created.forEach(u => URL.revokeObjectURL(u)); };
  }, [open, items, storeName, logo, title, footer, unit, showStock, perPage]);

  const fileName = (i: number) => `${storeName || 'store'}-พร้อมขาย${pages.length > 1 ? `-${i + 1}` : ''}.png`;
  const download = (i: number) => {
    const a = document.createElement('a'); a.href = pages[i].url; a.download = fileName(i); a.click();
  };
  const downloadAll = async () => { for (let i = 0; i < pages.length; i++) { download(i); await new Promise(r => setTimeout(r, 300)); } };
  const files = pages.map((p, i) => new File([p.blob], fileName(i), { type: 'image/png' }));
  const canShare = typeof navigator !== 'undefined' && !!navigator.canShare && files.length > 0 && navigator.canShare({ files });
  const share = async () => { try { await navigator.share({ files, title: `${storeName} · ${title}` }); } catch { /* cancelled */ } };

  return (
    <Modal open={open} onCancel={onClose} title="ส่งออกรูปสินค้าพร้อมขาย" width={760} footer={[
      canShare && <Button key="share" icon={<ShareAltOutlined />} disabled={busy} onClick={() => void share()}>แชร์</Button>,
      <Button key="dl" type="primary" icon={<DownloadOutlined />} disabled={busy || !pages.length} onClick={() => void downloadAll()}>
        {pages.length > 1 ? `ดาวน์โหลดทั้งหมด (${pages.length} รูป)` : 'ดาวน์โหลดรูป'}
      </Button>,
    ]}>
      <div className="shop-poster">
        <div className="shop-poster__opts">
          <label className="shop-field">ข้อความท้ายรูป<Input value={footer} onChange={e => setFooter(e.target.value)} maxLength={60} placeholder="เว้นว่างได้" /></label>
          <div className="shop-field">สินค้าต่อรูป
            <Segmented value={perPage} onChange={v => setPerPage(Number(v))} options={[{ value: 4, label: '4' }, { value: 9, label: '9' }, { value: 16, label: '16' }]} />
          </div>
          <label className="shop-field shop-poster__switch">แสดงจำนวนคงเหลือ<Switch checked={showStock} onChange={setShowStock} /></label>
        </div>
        <p className="shop-muted shop-poster__note">ใช้สินค้าที่มีของตามตัวกรองตอนนี้ {items.length} รายการ · รูปขนาด 1080×1080</p>
        {error && <Alert type="error" showIcon message={error} />}
        {!items.length ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="ไม่มีสินค้าพร้อมขายในตัวกรองนี้" />
          : busy && !pages.length ? <div className="shop-center"><Spin /></div>
          : <div className={`shop-poster__pages${pages.length === 1 ? ' is-single' : ''}`}>
              {pages.map((p, i) => (
                <figure key={p.url}>
                  <img src={p.url} alt={`รูปที่ ${i + 1}`} />
                  {pages.length > 1 && <figcaption><span>รูปที่ {i + 1}</span><Button size="small" type="link" icon={<DownloadOutlined />} onClick={() => download(i)}>ดาวน์โหลด</Button></figcaption>}
                </figure>
              ))}
            </div>}
      </div>
    </Modal>
  );
}

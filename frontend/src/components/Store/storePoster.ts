// Renders "ready to sell" posters (1080×1080 PNG) for social posts, straight to canvas.

export type PosterItem = { name: string; price: number; stock: number; image?: string | null };
export type PosterOptions = {
  storeName: string;
  logo?: string | null;
  title: string;          // e.g. "สินค้าพร้อมขาย"
  footer: string;         // e.g. "สนใจทักแชทได้เลย"
  unit: string;           // e.g. "กอง"
  showStock: boolean;
  perPage: number;        // 4 | 9 | 16
};

const SIZE = 1080;
const FONT = "'Inter', 'IBM Plex Sans Thai', 'Noto Sans Thai', Tahoma, sans-serif";

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image();
    const timer = window.setTimeout(() => resolve(null), 10000);
    img.crossOrigin = 'anonymous';
    img.onload = () => { clearTimeout(timer); resolve(img); };
    img.onerror = () => { clearTimeout(timer); resolve(null); };
    img.src = url;
  });
}

const money = (n: number) => `฿${new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 }).format(n)}`;
const num = (n: number) => n.toLocaleString('th-TH');

/** Split text into word-ish pieces (Thai has no spaces), then wrap to at most `maxLines`. */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number, maxLines: number): string[] {
  const Seg = (Intl as unknown as { Segmenter?: new (l: string, o: { granularity: string }) => { segment(s: string): Iterable<{ segment: string }> } }).Segmenter;
  const parts = Seg ? [...new Seg('th', { granularity: 'word' }).segment(text)].map(s => s.segment) : [...text];
  const lines: string[] = [];
  let line = '';
  for (const part of parts) {
    if (ctx.measureText(line + part).width <= width || !line) { line += part; continue; }
    lines.push(line.trimEnd()); line = part.trimStart();
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && lines.join('').length < text.trim().length) {
    let last = lines[maxLines - 1];
    while (last && ctx.measureText(last + '…').width > width) last = last.slice(0, -1);
    lines[maxLines - 1] = last + '…';
  }
  // A single unbreakable chunk can still be too wide: shorten by characters.
  return lines.map(l => { let s = l; while (s.length > 1 && ctx.measureText(s).width > width) s = s.slice(0, -2) + '…'; return s; });
}

function drawContain(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, size: number) {
  const scale = Math.min(size / img.width, size / img.height);
  const w = img.width * scale, h = img.height * scale;
  ctx.save();
  // Small pixel-art sprites stay crisp when enlarged; real photos are smoothed.
  ctx.imageSmoothingEnabled = scale < 2;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, x + (size - w) / 2, y + (size - h) / 2, w, h);
  ctx.restore();
}

export async function renderStorePosters(items: PosterItem[], opts: PosterOptions): Promise<HTMLCanvasElement[]> {
  if (!items.length) throw new Error('ไม่มีสินค้าพร้อมขายให้ส่งออก');
  await document.fonts?.ready;
  const urls = [...new Set(items.map(i => i.image).filter((u): u is string => !!u))];
  const images = new Map(await Promise.all(urls.map(async u => [u, await loadImage(u)] as const)));
  const logo = opts.logo ? await loadImage(opts.logo) : null;
  const pages: PosterItem[][] = [];
  for (let i = 0; i < items.length; i += opts.perPage) pages.push(items.slice(i, i + opts.perPage));
  const date = new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });

  return pages.map((page, pageIndex) => {
    const canvas = document.createElement('canvas');
    canvas.width = SIZE; canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('เบราว์เซอร์ไม่รองรับการสร้างรูป');
    const INK = '#111827', MUTED = '#6B7280', TILE = '#F5F6F8';
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, SIZE, SIZE);

    // Header: one quiet line — logo + store name on the left, title · date (· page) on the right.
    const pad = 56, headY = 72;
    let nameX = pad;
    if (logo) {
      const ls = 48;
      ctx.save(); ctx.beginPath(); ctx.roundRect(pad, headY - ls / 2, ls, ls, 12); ctx.clip();
      ctx.fillStyle = TILE; ctx.fillRect(pad, headY - ls / 2, ls, ls);
      drawContain(ctx, logo, pad, headY - ls / 2, ls); ctx.restore();
      nameX = pad + ls + 16;
    }
    const meta = [opts.title.trim(), date, pages.length > 1 ? `${pageIndex + 1}/${pages.length}` : ''].filter(Boolean).join('  ·  ');
    ctx.textBaseline = 'middle';
    ctx.font = `400 24px ${FONT}`; ctx.fillStyle = MUTED; ctx.textAlign = 'right';
    const metaW = ctx.measureText(meta).width;
    ctx.fillText(meta, SIZE - pad, headY);
    ctx.textAlign = 'left'; ctx.fillStyle = INK; ctx.font = `700 32px ${FONT}`;
    ctx.fillText(wrap(ctx, opts.storeName, SIZE - pad - metaW - 32 - nameX, 1)[0] ?? '', nameX, headY);
    ctx.textBaseline = 'alphabetic';

    // Footer (optional), small and centred.
    const foot = opts.footer.trim();
    const bottom = SIZE - (foot ? 84 : pad);
    if (foot) {
      ctx.fillStyle = MUTED; ctx.font = `400 24px ${FONT}`; ctx.textAlign = 'center';
      ctx.fillText(wrap(ctx, foot, SIZE - pad * 2, 1)[0] ?? '', SIZE / 2, SIZE - 44); ctx.textAlign = 'left';
    }

    // Grid of product pictures with a short caption underneath.
    const n = page.length;
    const cols = opts.perPage <= 4 ? 2 : opts.perPage <= 9 ? 3 : 4;
    const rows = Math.max(1, Math.ceil(n / cols));
    const rowsForSize = pages.length > 1 ? Math.ceil(opts.perPage / cols) : rows;
    const gapX = cols >= 4 ? 24 : 32, gapY = cols >= 4 ? 20 : 28;
    const top = headY + 52;
    const cellW = (SIZE - pad * 2 - gapX * (cols - 1)) / cols;
    const nameF = Math.round(Math.max(16, Math.min(28, cellW * 0.075)));
    const infoF = Math.round(Math.max(15, Math.min(26, cellW * 0.07)));
    const caption = 10 + nameF * 1.3 + 4 + infoF * 1.3;
    const cellH = Math.min((bottom - top - gapY * (rowsForSize - 1)) / rowsForSize, cellW + caption);
    const tile = Math.min(cellW, cellH - caption);
    const gridH = rows * cellH + (rows - 1) * gapY;
    const startY = top + Math.max(0, (bottom - top - gridH) / 2);

    page.forEach((item, i) => {
      const r = Math.floor(i / cols), c = i % cols;
      const inRow = r === rows - 1 ? n - r * cols : cols;
      const x = pad + (cols - inRow) * (cellW + gapX) / 2 + c * (cellW + gapX);
      const y = startY + r * (cellH + gapY);
      const cx = x + cellW / 2;
      const tx = cx - tile / 2;

      ctx.fillStyle = TILE; ctx.beginPath(); ctx.roundRect(tx, y, tile, tile, Math.min(24, tile * 0.1)); ctx.fill();
      const img = item.image ? images.get(item.image) : null;
      if (img) { const inset = tile * 0.1; drawContain(ctx, img, tx + inset, y + inset, tile - inset * 2); }

      ctx.textAlign = 'center';
      let ty = y + tile + 10 + nameF;
      ctx.fillStyle = INK; ctx.font = `500 ${nameF}px ${FONT}`;
      ctx.fillText(wrap(ctx, item.name, cellW, 1)[0] ?? '', cx, ty);
      ty += 4 + infoF * 1.3;

      const price = money(item.price);
      const stock = opts.showStock ? `  ·  เหลือ ${num(item.stock)} ${opts.unit}` : '';
      ctx.font = `700 ${infoF}px ${FONT}`; const pw = ctx.measureText(price).width;
      ctx.font = `400 ${infoF}px ${FONT}`; const sw = ctx.measureText(stock).width;
      const left = cx - (pw + sw) / 2;
      ctx.textAlign = 'left';
      ctx.fillStyle = INK; ctx.font = `700 ${infoF}px ${FONT}`; ctx.fillText(price, left, ty);
      if (stock) { ctx.fillStyle = MUTED; ctx.font = `400 ${infoF}px ${FONT}`; ctx.fillText(stock, left + pw, ty); }
    });
    return canvas;
  });
}

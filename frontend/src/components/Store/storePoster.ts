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
  style?: PosterStyle;
};

export type PosterStyle = 'card' | 'soft' | 'minimal';

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

type Theme = {
  bg: (ctx: CanvasRenderingContext2D) => void;
  card: { fill: string; radius: number; shadow?: string; stroke?: string } | null;
  tile: string; name: string; price: string; muted: string;
  stock: { fg: string; bg: string | null; dot?: string };
};

const THEMES: Record<PosterStyle, Theme> = {
  // White product cards on a soft grey page — the familiar marketplace look.
  card: {
    bg: ctx => { ctx.fillStyle = '#F0F9FF'; ctx.fillRect(0, 0, SIZE, SIZE); },
    card: { fill: '#FFFFFF', radius: 24, shadow: 'rgba(3, 105, 161, 0.08)', stroke: '#D6ECFA' },
    tile: '#FFFFFF', name: '#334155', price: '#0369A1', muted: '#3B5470',
    stock: { fg: '#4B5563', bg: '#F3F4F6' },
  },
  // Store colours, kept light: sky wash, white cards, warm stock tag.
  soft: {
    bg: ctx => { const g = ctx.createLinearGradient(0, 0, 0, SIZE); g.addColorStop(0, '#E0F2FE'); g.addColorStop(1, '#FFFFFF'); ctx.fillStyle = g; ctx.fillRect(0, 0, SIZE, SIZE); },
    card: { fill: '#FFFFFF', radius: 32, shadow: 'rgba(3, 105, 161, 0.10)', stroke: '#E0F2FE' },
    tile: '#FFFFFF', name: '#334155', price: '#0369A1', muted: '#64748B',
    stock: { fg: '#475569', bg: '#F1F5F9' },
  },
  // No boxes at all: picture, then a quiet line of text.
  minimal: {
    bg: ctx => { ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, SIZE, SIZE); },
    card: null,
    tile: '#FFFFFF', name: '#52525B', price: '#18181B', muted: '#71717A',
    stock: { fg: '#71717A', bg: null },
  },
};

export async function renderStorePosters(items: PosterItem[], opts: PosterOptions): Promise<HTMLCanvasElement[]> {
  if (!items.length) throw new Error('ไม่มีสินค้าพร้อมขายให้ส่งออก');
  await document.fonts?.ready;
  const urls = [...new Set(items.map(i => i.image).filter((u): u is string => !!u))];
  const images = new Map(await Promise.all(urls.map(async u => [u, await loadImage(u)] as const)));
  const pages: PosterItem[][] = [];
  for (let i = 0; i < items.length; i += opts.perPage) pages.push(items.slice(i, i + opts.perPage));
  const T = THEMES[opts.style ?? 'card'];
  const logo = opts.logo ? await loadImage(opts.logo) : null;
  const date = new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });

  return pages.map((page) => {
    const canvas = document.createElement('canvas');
    canvas.width = SIZE; canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('เบราว์เซอร์ไม่รองรับการสร้างรูป');
    T.bg(ctx);
    ctx.textBaseline = 'alphabetic';

    // Header band: logo + store name + "title · date", page pill on the right.
    const headH = 150;
    const band = ctx.createLinearGradient(0, 0, SIZE, 0);
    band.addColorStop(0, '#0369A1'); band.addColorStop(1, '#0EA5E9');
    ctx.fillStyle = band; ctx.fillRect(0, 0, SIZE, headH);
    ctx.fillStyle = '#FACC15'; ctx.fillRect(0, headH, SIZE, 8);
    const nx = 48, nRight = SIZE - 48;
    ctx.textAlign = 'left'; ctx.fillStyle = '#FFFFFF'; ctx.font = `700 46px ${FONT}`;
    ctx.fillText(wrap(ctx, opts.storeName, nRight - nx, 1)[0] ?? '', nx, 76);
    ctx.fillStyle = '#E0F2FE'; ctx.font = `500 26px ${FONT}`;
    ctx.fillText(wrap(ctx, `${opts.title} · ${date}`, nRight - nx, 1)[0] ?? '', nx, 116);
    const gridTop = headH + 8 + 32;

    // Footer, bottom-right: contact text + profile picture.
    const pad = 48;
    const foot = opts.footer.trim();
    const footH = foot || logo ? 96 : 40;
    const bottom = SIZE - footH;
    if (foot || logo) {
      const av = 60, cy = SIZE - footH / 2 + 4;
      let right = SIZE - pad;
      if (logo) {
        const ax = right - av, ay = cy - av / 2;
        ctx.save(); ctx.shadowColor = 'rgba(3, 105, 161, 0.25)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 3;
        ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(ax + av / 2, cy, av / 2 + 3, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        ctx.save(); ctx.beginPath(); ctx.arc(ax + av / 2, cy, av / 2, 0, Math.PI * 2); ctx.clip();
        ctx.fillStyle = '#F0F9FF'; ctx.fillRect(ax, ay, av, av);
        const sc = Math.max(av / logo.width, av / logo.height); // cover the circle
        ctx.drawImage(logo, ax + (av - logo.width * sc) / 2, ay + (av - logo.height * sc) / 2, logo.width * sc, logo.height * sc);
        ctx.restore();
        right = ax - 16;
      }
      if (foot) {
        ctx.fillStyle = '#0369A1'; ctx.font = `600 30px ${FONT}`; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.fillText(wrap(ctx, foot, right - pad, 1)[0] ?? '', right, cy + 1);
        ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
      }
    }

    // Grid geometry.
    const n = page.length;
    const cols = opts.perPage <= 4 ? 2 : opts.perPage <= 9 ? 3 : 4;
    const rows = Math.max(1, Math.ceil(n / cols));
    const rowsForSize = pages.length > 1 ? Math.ceil(opts.perPage / cols) : rows;
    const gap = cols >= 4 ? 18 : cols === 3 ? 24 : 32;
    const cellW = (SIZE - pad * 2 - gap * (cols - 1)) / cols;
    const inset = T.card ? Math.round(cellW * 0.055) : 0;         // card padding
    const tileW = cellW - inset * 2;                              // cards always use the full column width
    const nameF = Math.round(Math.max(15, Math.min(28, tileW * 0.068)));
    const priceF = Math.round(Math.max(22, Math.min(50, tileW * 0.12)));
    const stockF0 = Math.round(Math.max(14, Math.min(24, tileW * 0.062)));
    const textH = 14 + nameF * 1.35 + priceF * 1.2;
    const maxCellH = (bottom - gridTop - gap * (rowsForSize - 1)) / rowsForSize;
    const tileH = Math.min(tileW, maxCellH - inset * 2 - textH);   // picture area may be wider than tall
    const cellH = tileH + inset * 2 + textH;
    const cardW = cellW;
    const gridH = rows * cellH + (rows - 1) * gap;
    const startY = gridTop + Math.max(0, (bottom - gridTop - gridH) / 2);

    page.forEach((item, i) => {
      const r = Math.floor(i / cols), c = i % cols;
      const inRow = r === rows - 1 ? n - r * cols : cols;
      const colX = pad + (cols - inRow) * (cellW + gap) / 2 + c * (cellW + gap);
      const x = colX + (cellW - cardW) / 2;
      const y = startY + r * (cellH + gap);

      if (T.card) {
        ctx.save();
        if (T.card.shadow) { ctx.shadowColor = T.card.shadow; ctx.shadowBlur = 28; ctx.shadowOffsetY = 8; }
        ctx.fillStyle = T.card.fill; ctx.beginPath(); ctx.roundRect(x, y, cardW, cellH, Math.min(T.card.radius, cardW * 0.1)); ctx.fill();
        ctx.restore();
        if (T.card.stroke) { ctx.strokeStyle = T.card.stroke; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x + 1, y + 1, cardW - 2, cellH - 2, Math.min(T.card.radius, cardW * 0.1)); ctx.stroke(); }
      }

      // Picture
      const tx = x + inset, ty = y + inset;
      ctx.fillStyle = T.tile; ctx.beginPath(); ctx.roundRect(tx, ty, tileW, tileH, Math.min(20, tileH * 0.08)); ctx.fill();
      const img = item.image ? images.get(item.image) : null;
      if (img) { const m = tileH * 0.07, sz = tileH - m * 2; drawContain(ctx, img, tx + (tileW - sz) / 2, ty + m, sz); }

      // Name
      const tile = tileW;
      const left = tx, right = tx + tile;
      let by = ty + tileH + 14 + nameF;
      ctx.textAlign = 'left'; ctx.fillStyle = T.name; ctx.font = `500 ${nameF}px ${FONT}`;
      ctx.fillText(wrap(ctx, item.name, tile, 1)[0] ?? '', left, by);

      // Price (left) + stock (right) on one line, stock shrinks if needed.
      by += priceF * 1.2;
      const priceText = money(item.price);
      ctx.font = `800 ${priceF}px ${FONT}`;
      const pw = ctx.measureText(priceText).width;
      ctx.fillStyle = T.price; ctx.fillText(priceText, left, by);
      if (opts.showStock) {
        const label = `เหลือ ${num(item.stock)} ${opts.unit}`;
        let sf = stockF0;
        const widthOf = () => { ctx.font = `600 ${sf}px ${FONT}`; return ctx.measureText(label).width + (T.stock.bg ? sf * 1.2 : T.stock.dot ? sf * 1.1 : 0); };
        let sw = widthOf();
        while (sf > 11 && pw + 12 + sw > tile) { sf -= 1; sw = widthOf(); }
        const midY = by - priceF * 0.36;
        if (T.stock.bg) {
          const h = sf * 1.8;
          ctx.fillStyle = T.stock.bg; ctx.beginPath(); ctx.roundRect(right - sw, midY - h / 2, sw, h, h / 2); ctx.fill();
          ctx.fillStyle = T.stock.fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(label, right - sw / 2, midY + 1);
        } else {
          ctx.fillStyle = T.stock.fg; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
          ctx.fillText(label, right, midY + 1);
          if (T.stock.dot) {
            ctx.font = `600 ${sf}px ${FONT}`;
            const tw = ctx.measureText(label).width;
            ctx.fillStyle = T.stock.dot; ctx.beginPath(); ctx.arc(right - tw - sf * 0.6, midY, sf * 0.28, 0, Math.PI * 2); ctx.fill();
          }
        }
        ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
      }
    });
    return canvas;
  });
}

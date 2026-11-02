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
  const scale = Math.min(1, size / img.width, size / img.height);
  const w = img.width * scale, h = img.height * scale;
  ctx.save();
  // Preserve source proportions and only shrink oversized product images.
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
    stock: { fg: '#713F12', bg: '#FACC15' },
  },
  // Store colours, kept light: sky wash, white cards, warm stock tag.
  soft: {
    bg: ctx => { const g = ctx.createLinearGradient(0, 0, 0, SIZE); g.addColorStop(0, '#E0F2FE'); g.addColorStop(1, '#FFFFFF'); ctx.fillStyle = g; ctx.fillRect(0, 0, SIZE, SIZE); },
    card: { fill: '#FFFFFF', radius: 32, shadow: 'rgba(3, 105, 161, 0.10)', stroke: '#E0F2FE' },
    tile: '#FFFFFF', name: '#334155', price: '#0369A1', muted: '#64748B',
    stock: { fg: '#713F12', bg: '#FACC15' },
  },
  // No boxes at all: picture, then a quiet line of text.
  minimal: {
    bg: ctx => { ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, SIZE, SIZE); },
    card: null,
    tile: '#FFFFFF', name: '#52525B', price: '#18181B', muted: '#71717A',
    stock: { fg: '#713F12', bg: '#FACC15' },
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
  const logo = await loadImage(opts.logo || '/avatars/store-duck.jpeg');
  const date = new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });

  return pages.map((page) => {
    const canvas = document.createElement('canvas');
    canvas.width = SIZE; canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('เบราว์เซอร์ไม่รองรับการสร้างรูป');
    T.bg(ctx);
    ctx.textBaseline = 'alphabetic';

    // Header band: logo + store name + "title · date", page pill on the right.
    const headH = 130;
    const band = ctx.createLinearGradient(0, 0, SIZE, 0);
    band.addColorStop(0, '#0369A1'); band.addColorStop(1, '#0EA5E9');
    ctx.fillStyle = band; ctx.fillRect(0, 0, SIZE, headH);
    ctx.fillStyle = '#FACC15'; ctx.fillRect(0, headH, SIZE, 8);
    if (logo) {
      const av = 96, ax = 40, ay = 17;
      ctx.save();
      ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(ax + av / 2, ay + av / 2, av / 2 + 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(ax + av / 2, ay + av / 2, av / 2, 0, Math.PI * 2); ctx.clip();
      if (!opts.logo || opts.logo === '/avatars/store-duck.jpeg') {
        // Crop only the default duck's white margins, leaving uploaded images intact.
        ctx.drawImage(logo, logo.width * 0.23, logo.height * 0.20, logo.width * 0.53, logo.height * 0.565, ax, ay, av, av);
      } else {
        const scale = Math.max(av / logo.width, av / logo.height);
        ctx.drawImage(logo, ax + (av - logo.width * scale) / 2, ay + (av - logo.height * scale) / 2, logo.width * scale, logo.height * scale);
      }
      ctx.restore();
    }
    const nx = logo ? 160 : 48, nRight = SIZE - 48;
    ctx.textAlign = 'left'; ctx.fillStyle = '#FFFFFF'; ctx.font = `700 46px ${FONT}`;
    ctx.fillText(wrap(ctx, opts.storeName, nRight - nx, 1)[0] ?? '', nx, 66);
    ctx.fillStyle = '#E0F2FE'; ctx.font = `500 26px ${FONT}`;
    ctx.fillText(wrap(ctx, `${opts.title} · ${date}`, nRight - nx, 1)[0] ?? '', nx, 104);
    const gridTop = headH + 8 + 32;

    // Contact footer; the shop avatar now belongs to the header.
    const pad = 48;
    const foot = opts.footer.trim();
    const footH = foot ? 96 : 40;
    const bottom = SIZE - footH;
    if (foot) {
      ctx.fillStyle = '#0369A1'; ctx.font = `600 30px ${FONT}`;
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(wrap(ctx, foot, SIZE - pad * 2, 1)[0] ?? '', SIZE - pad, SIZE - footH / 2 + 5);
      ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    }

    // Grid geometry.
    const n = page.length;
    const cols = opts.perPage <= 4 ? 2 : opts.perPage <= 9 ? 3 : 4;
    const rows = Math.max(1, Math.ceil(n / cols));
    const rowsForSize = pages.length > 1 ? Math.ceil(opts.perPage / cols) : rows;
    const gap = cols >= 4 ? 18 : cols === 3 ? 24 : 32;
    const cellW = (SIZE - pad * 2 - gap * (cols - 1)) / cols;
    const inset = Math.round(cellW * 0.065);         // card padding
    const tileW = cellW - inset * 2;                              // cards always use the full column width
    const nameF = Math.round(Math.max(22, Math.min(36, tileW * 0.10)));
    const priceF = Math.round(Math.max(30, Math.min(56, tileW * 0.15)));
    const stockF0 = Math.round(Math.max(18, Math.min(26, tileW * 0.08)));
    const rowH = Math.max(priceF * 1.2, opts.showStock ? stockF0 * 1.6 : 0);
    const maxCellH = (bottom - gridTop - gap * (rowsForSize - 1)) / rowsForSize;
    const cellH = maxCellH;
    const contentH = cellH - inset * 2 - rowH - 20;
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

      // Give the image the full available area with its name centered underneath.
      const tx = x + inset, ty = y + inset;
      const labelSize = Math.min(nameF, cols >= 4 ? 23 : 30);
      const lineH = labelSize * 1.35;
      ctx.font = `600 ${labelSize}px ${FONT}`;
      const lines = wrap(ctx, item.name, tileW, 1);
      const pictureSize = Math.min(tileW, Math.max(24, contentH - lineH - 8));
      const img = item.image ? images.get(item.image) : null;
      if (img) drawContain(ctx, img, tx + (tileW - pictureSize) / 2, ty, pictureSize);
      ctx.textAlign = 'center'; ctx.fillStyle = T.name;
      ctx.fillText(lines[0] ?? '', tx + tileW / 2, ty + pictureSize + 8 + labelSize);

      const rowTop = ty + contentH + 20;
      ctx.strokeStyle = '#E0EDF5'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(tx, rowTop - 10); ctx.lineTo(tx + tileW, rowTop - 10); ctx.stroke();
      const midY = rowTop + rowH / 2;
      const stockW = opts.showStock ? tileW * 0.44 : 0;
      const priceW = opts.showStock ? tileW - stockW - 10 : tileW;
      const priceText = money(item.price);
      let pf = priceF;
      ctx.font = `800 ${pf}px ${FONT}`;
      while (pf > 16 && ctx.measureText(priceText).width > priceW) {
        pf -= 1; ctx.font = `800 ${pf}px ${FONT}`;
      }
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = T.price;
      ctx.fillText(priceText, tx, midY, priceW);
      if (opts.showStock) {
        const label = `${num(item.stock)} ${opts.unit}`;
        let sf = Math.min(stockF0, pf * 0.78);
        ctx.font = `800 ${sf}px ${FONT}`;
        while (sf > 14 && ctx.measureText(label).width + sf * 0.8 > stockW) {
          sf -= 1; ctx.font = `800 ${sf}px ${FONT}`;
        }
        const h = sf * 1.6;
        const sw = Math.min(stockW, ctx.measureText(label).width + sf * 0.8);
        const right = tx + tileW;
        ctx.fillStyle = T.stock.bg ?? '#FACC15';
        ctx.beginPath(); ctx.roundRect(right - sw, midY - h / 2, sw, h, h / 2); ctx.fill();
        ctx.fillStyle = T.stock.fg; ctx.textAlign = 'center';
        ctx.fillText(label, right - sw / 2, midY, sw - sf * 0.8);
      }
      ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    });
    return canvas;
  });
}

// Renders "ready to sell" posters as a single tall PNG for social posts, straight to canvas.

export type PosterItem = { name: string; price: number; stock: number; image?: string | null };
export type PosterOptions = {
  storeName: string;
  logo?: string | null;
  footer: string;         // e.g. "สนใจทักแชทได้เลย"
  unit: string;           // e.g. "กอง"
  showStock: boolean;
  cols: number;           // 1–5 columns per row; rows auto-expand
  style?: PosterStyle;
};

export type PosterStyle = 'card' | 'soft' | 'minimal';

const FONT = "'IBM Plex Sans Thai', 'Noto Sans Thai', Tahoma, sans-serif";

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
  ctx.imageSmoothingEnabled = scale < 2;
  ctx.imageSmoothingQuality = 'high';
  // Center both axes
  ctx.drawImage(img, x + (size - w) / 2, y + (size - h) / 2, w, h);
  ctx.restore();
}

type Theme = {
  bg: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  card: { fill: string; radius: number; shadow?: string; stroke?: string } | null;
  tile: string; name: string; price: string; muted: string;
  stock: { fg: string; bg: string | null; dot?: string };
};

const THEMES: Record<PosterStyle, Theme> = {
  card: {
    bg: (ctx, w, h) => { ctx.fillStyle = '#F0F9FF'; ctx.fillRect(0, 0, w, h); },
    card: { fill: '#FFFFFF', radius: 24, shadow: 'rgba(3, 105, 161, 0.08)', stroke: '#D6ECFA' },
    tile: '#FFFFFF', name: '#334155', price: '#0C1E33', muted: '#3B5470',
    stock: { fg: '#713F12', bg: '#FACC15' },
  },
  soft: {
    bg: (ctx, w, h) => { const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#E0F2FE'); g.addColorStop(1, '#FFFFFF'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); },
    card: { fill: '#FFFFFF', radius: 32, shadow: 'rgba(3, 105, 161, 0.10)', stroke: '#E0F2FE' },
    tile: '#FFFFFF', name: '#334155', price: '#0C1E33', muted: '#64748B',
    stock: { fg: '#713F12', bg: '#FACC15' },
  },
  minimal: {
    bg: (ctx, w, h) => { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); },
    card: { fill: '#FFFFFF', radius: 16, shadow: 'rgba(0,0,0,0.08)' },
    tile: '#FFFFFF', name: '#52525B', price: '#0C1E33', muted: '#71717A',
    stock: { fg: '#713F12', bg: '#FACC15' },
  },
};

export async function renderStorePosters(items: PosterItem[], opts: PosterOptions): Promise<HTMLCanvasElement[]> {
  if (!items.length) throw new Error('ไม่มีสินค้าพร้อมขายให้ส่งออก');
  await document.fonts?.ready;
  const urls = [...new Set(items.map(i => i.image).filter((u): u is string => !!u))];
  const images = new Map(await Promise.all(urls.map(async u => [u, await loadImage(u)] as const)));
  const T = THEMES[opts.style ?? 'card'];
  const logo = await loadImage(opts.logo || '/avatars/store-duck.jpeg');

  const W = 1080;
  const pad = 48;
  const cols = Math.max(1, Math.min(10, opts.cols));
  const n = items.length;
  const rows = Math.max(1, Math.ceil(n / cols));
  const gap = cols >= 5 ? 12 : cols >= 4 ? 16 : cols === 3 ? 20 : cols === 2 ? 28 : 0;
  const cellW = (W - pad * 2 - gap * (cols - 1)) / cols;
  const radius = Math.min(T.card ? T.card.radius : 0, cellW * 0.08);

  const nameF = Math.round(Math.max(20, Math.min(34, cellW * 0.095)));
  const priceF = Math.round(Math.max(28, Math.min(52, cellW * 0.14)));
  const stockF0 = Math.round(Math.max(16, Math.min(24, cellW * 0.075)));
  const infoBarH = Math.round(nameF * 1.4 + priceF * 1.7 + 24);
  const cellH = cellW + infoBarH;

  // Header
  const headH = 148;
  const gridTop = headH + 8 + 32;

  // Footer
  const foot = opts.footer.trim();
  const footH = foot ? 96 : 40;

  // Total canvas height = header + grid + footer
  const gridH = rows * cellH + (rows - 1) * gap;
  const H = gridTop + gridH + 32 + footH;

  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('เบราว์เซอร์ไม่รองรับการสร้างรูป');

  // Background — tile the theme bg over full height
  T.bg(ctx, W, H);
  ctx.textBaseline = 'alphabetic';

  // Header band: logo + store name + tagline
  const band = ctx.createLinearGradient(0, 0, W, 0);
  band.addColorStop(0, '#0369A1'); band.addColorStop(1, '#0EA5E9');
  ctx.fillStyle = band; ctx.fillRect(0, 0, W, headH);
  ctx.fillStyle = '#FACC15'; ctx.fillRect(0, headH, W, 8);
  if (logo) {
    const av = 96, ax = 40, ay = 17;
    ctx.save();
    ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(ax + av / 2, ay + av / 2, av / 2 + 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(ax + av / 2, ay + av / 2, av / 2, 0, Math.PI * 2); ctx.clip();
    if (!opts.logo || opts.logo === '/avatars/store-duck.jpeg') {
      ctx.drawImage(logo, logo.width * 0.23, logo.height * 0.20, logo.width * 0.53, logo.height * 0.565, ax, ay, av, av);
    } else {
      const scale = Math.max(av / logo.width, av / logo.height);
      ctx.drawImage(logo, ax + (av - logo.width * scale) / 2, ay + (av - logo.height * scale) / 2, logo.width * scale, logo.height * scale);
    }
    ctx.restore();
  }
  const nx = logo ? 160 : 48, nRight = W - 48;
  ctx.textAlign = 'left'; ctx.fillStyle = '#FFFFFF'; ctx.font = `700 46px ${FONT}`;
  ctx.fillText(wrap(ctx, opts.storeName, nRight - nx, 1)[0] ?? '', nx, 70);
  ctx.fillStyle = 'rgba(224,242,254,0.55)'; ctx.font = `300 20px ${FONT}`;
  ctx.fillText('Ped Kab Kub Kabb', nx, 102);

  // Footer
  if (foot) {
    ctx.fillStyle = '#0369A1'; ctx.font = `600 30px ${FONT}`;
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText(wrap(ctx, foot, W - pad * 2, 1)[0] ?? '', W - pad, H - footH / 2 + 5);
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  }

  // Grid — all items in one pass, rows grow downward
  const startY = gridTop;

  items.forEach((item, i) => {
    const r = Math.floor(i / cols), c = i % cols;
    const x = pad + c * (cellW + gap);
    const y = startY + r * (cellH + gap);

    // Card background
    if (T.card) {
      ctx.save();
      if (T.card.shadow) { ctx.shadowColor = T.card.shadow; ctx.shadowBlur = 24; ctx.shadowOffsetY = 6; }
      ctx.fillStyle = T.card.fill;
      ctx.beginPath(); ctx.roundRect(x, y, cellW, cellH, radius); ctx.fill();
      ctx.restore();
      if (T.card.stroke) {
        ctx.strokeStyle = T.card.stroke; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.roundRect(x + 0.75, y + 0.75, cellW - 1.5, cellH - 1.5, radius); ctx.stroke();
      }
    }

    // Image zone
    const imgSize = cellW;
    ctx.save();
    ctx.beginPath();
    if (radius > 0) { ctx.roundRect(x, y, imgSize, imgSize, [radius, radius, 0, 0]); }
    else { ctx.rect(x, y, imgSize, imgSize); }
    ctx.clip();
    ctx.fillStyle = T.card ? T.card.fill : '#FFFFFF';
    ctx.fillRect(x, y, imgSize, imgSize);
    const img = item.image ? images.get(item.image) : null;
    if (img) {
      const imgPad = Math.round(imgSize * 0.18);
      drawContain(ctx, img, x + imgPad, y + imgPad, imgSize - imgPad * 2);
    }
    ctx.restore();

    // Info bar
    const infoY = y + imgSize;
    const infoX = x;
    if (T.card) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(infoX, infoY, cellW, infoBarH, [0, 0, radius, radius]);
      ctx.fillStyle = T.card.fill;
      ctx.fill();
      ctx.restore();
    }

    const px = infoX + Math.round(cellW * 0.07);
    const pRight = infoX + cellW - Math.round(cellW * 0.07);
    const pWidth = pRight - px;

    // Product name
    const nameY = infoY + Math.round(nameF * 1.15) + 8;
    ctx.font = `600 ${nameF}px ${FONT}`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = T.name;
    const nameLines = wrap(ctx, item.name, pWidth, 1);
    ctx.fillText(nameLines[0] ?? '', px, nameY, pWidth);

    // Price row
    const priceRowY = nameY + Math.round(priceF * 1.45) + 4;
    const midPriceY = priceRowY - priceF * 0.5;
    const numText = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 }).format(item.price);
    const bahtF = Math.round(priceF * 0.62);
    const bahtSymbol = '฿';

    ctx.textBaseline = 'middle';
    ctx.font = `700 ${bahtF}px ${FONT}`;
    ctx.fillStyle = T.price;
    ctx.textAlign = 'left';
    const bahtW = ctx.measureText(bahtSymbol).width + 3;
    ctx.fillText(bahtSymbol, px, midPriceY + Math.round(priceF * 0.08));

    ctx.font = `800 ${priceF}px ${FONT}`;
    let pf = priceF;
    const stockW = opts.showStock ? pWidth * 0.46 : 0;
    const availW = pWidth - bahtW - stockW - (opts.showStock ? 12 : 0);
    while (pf > 18 && ctx.measureText(numText).width > availW) {
      pf -= 1; ctx.font = `800 ${pf}px ${FONT}`;
    }
    ctx.fillText(numText, px + bahtW, midPriceY, availW);

    // Stock pill — vertically centered with the price number
    if (opts.showStock) {
      const label = `${num(item.stock)} ${opts.unit}`;
      let sf = stockF0;
      ctx.font = `700 ${sf}px ${FONT}`;
      while (sf > 13 && ctx.measureText(label).width + sf * 0.9 > stockW) {
        sf -= 1; ctx.font = `700 ${sf}px ${FONT}`;
      }
      const pillH = Math.round(sf * 2.0);  // taller pill for Thai font
      const pillW = Math.min(stockW, ctx.measureText(label).width + Math.round(sf * 1.2));
      const pillX = pRight - pillW;
      const pillCenterY = midPriceY;  // align to price row center
      const pillY = pillCenterY - pillH / 2;
      ctx.fillStyle = T.stock.bg ?? '#F59E0B';
      ctx.beginPath(); ctx.roundRect(pillX, pillY, pillW, pillH, pillH / 2); ctx.fill();
      // Draw text: use alphabetic baseline offset inside pill for optical centering
      ctx.fillStyle = T.stock.fg;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      const metrics = ctx.measureText(label);
      const textH = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
      const textY = pillY + (pillH + textH) / 2 - metrics.actualBoundingBoxDescent;
      ctx.fillText(label, pillX + pillW / 2, textY, pillW - Math.round(sf * 0.6));
    }

    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  });

  return [canvas];
}

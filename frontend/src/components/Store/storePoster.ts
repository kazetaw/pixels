// Renders square posters with square product cards centered below the store header.

export type PosterItem = { name: string; price: number; stock: number; image?: string | null };
export type PosterOptions = {
  storeName: string;
  logo?: string | null;
  footer: string;
  unit: string;
  showStock: boolean;
  cols: number;
  perPage?: 4 | 9 | 16;
  imgPosition?: 'top' | 'center' | 'bottom';
  style?: PosterStyle;
  // Layout customization
  textAlign?: 'left' | 'center' | 'right';
  imgSize?: 'xs' | 'small' | 'medium' | 'large';
  imgRatio?: '1:1' | '4:5' | '3:4';
  priceDecimal?: 0 | 2;
  pillPosition?: 'right' | 'left' | 'inline';
  showBahtSymbol?: boolean;
  // Style overrides
  fontScale?: number;       // 0.6–1.6, default 1
  nameColor?: string;       // hex, default from theme
  priceColor?: string;
  cardColor?: string;       // card fill
  cardStroke?: string;      // card border color
  // Stock pill custom colors
  pillBg?: string;          // pill background, default #FACC15
  pillFg?: string;          // pill text color, default #713F12
  // Per-field font size override (0 = auto from layout)
  nameFontSize?: number;    // 1–40
  priceFontSize?: number;   // 1–40
  stockFontSize?: number;   // 1–40
};

export type PosterStyle = 'card' | 'soft' | 'minimal';

export function posterGeometry(cols: number, rows: number, hasFooter: boolean) {
  const width = 1080, height = 1080, padding = 48, gap = 16, headerHeight = 110;
  const contentTop = headerHeight + 8;
  const contentBottom = height - (hasFooter ? 64 : 0);
  const cardSize = Math.min(
    (width - padding * 2 - gap * (cols - 1)) / cols,
    (contentBottom - contentTop - padding * 2 - gap * (rows - 1)) / rows,
  );
  const gridHeight = rows * cardSize + gap * (rows - 1);
  const gridLeft = (width - (cols * cardSize + gap * (cols - 1))) / 2;
  const gridTop = contentTop + (contentBottom - contentTop - gridHeight) / 2;
  return { width, height, padding, gap, headerHeight, gridTop, gridLeft, cardSize, gridHeight };
}

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
  // Load fonts and all images in parallel — don't await serially
  const urls = [...new Set(items.map(i => i.image).filter((u): u is string => !!u))];
  const [, ...loadedImgs] = await Promise.all([
    document.fonts?.ready,
    ...urls.map(u => loadImage(u)),
  ]);
  const images = new Map(urls.map((u, i) => [u, loadedImgs[i] as HTMLImageElement | null]));
  const logo = await loadImage(opts.logo || '/avatars/store-duck.jpeg');
  const theme = THEMES[opts.style ?? 'card'];
  const perPage = opts.perPage ?? 4;
  const cols = Math.max(1, Math.min(Math.sqrt(perPage), Math.floor(opts.cols) || 2));
  const rows = Math.ceil(perPage / cols);
  const geometry = posterGeometry(cols, rows, !!opts.footer.trim());
  const { width: W, height: H, padding: pad, gap, headerHeight: headH, gridTop, cardSize: cardW } = geometry;
  const scale = Math.max(0.6, Math.min(1.6, opts.fontScale ?? 1));
  const cardH = cardW;
  const gridLeft = geometry.gridLeft;

  // Font sizes drive the card split — compute them first.
  // Auto sizes assume 38% text zone as baseline.
  const _autoInfoH = Math.round(cardH * 0.38);
  const autoNameF  = Math.min(Math.max(4, Math.round(_autoInfoH * 0.17 * scale)), cols === 2 ? 28 : cols === 3 ? 24 : 20);
  const autoPriceF = Math.min(Math.round(_autoInfoH * 0.30 * scale), cols === 2 ? 52 : cols === 3 ? 40 : 32);
  const autoStockF = Math.round(autoPriceF * 0.62);

  const nameF  = opts.nameFontSize  ? Math.max(1, Math.min(120, opts.nameFontSize))  : autoNameF;
  const priceF = opts.priceFontSize ? Math.max(1, Math.min(120, opts.priceFontSize)) : autoPriceF;
  const stockF = opts.stockFontSize ? Math.max(1, Math.min(120, opts.stockFontSize)) : autoStockF;

  // Measure the actual text block height and split card accordingly.
  // infoH = text block + 24px breathing room, minimum 28% of card height.
  const _nameBlockH = 1 * nameF * 1.3;  // 1 line only
  const _sh         = opts.showStock ? stockF + 16 : 0;
  const _priceRowH  = Math.max(priceF * 1.2, _sh);
  const _textBlockH = _nameBlockH + 10 + _priceRowH;
  const infoH  = Math.max(_textBlockH + 24, Math.round(cardH * 0.28));
  const imageH = cardH - infoH;
  const pageCount = Math.ceil(items.length / perPage);
  return Array.from({ length: pageCount }, (_, pageIndex) => {
    const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('เบราว์เซอร์ไม่รองรับการสร้างรูป');
    theme.bg(ctx, W, H);
    ctx.fillStyle = '#0369A1'; ctx.fillRect(0, 0, W, headH);
    ctx.fillStyle = '#FACC15'; ctx.fillRect(0, headH, W, 8);
    if (logo) {
      const av = 78, ax = pad, ay = (headH - av) / 2;
      ctx.save(); ctx.beginPath(); ctx.arc(ax + av / 2, ay + av / 2, av / 2, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = '#fff'; ctx.fillRect(ax, ay, av, av);
      if (!opts.logo || opts.logo === '/avatars/store-duck.jpeg') {
        ctx.drawImage(logo, logo.width * .23, logo.height * .20, logo.width * .53, logo.height * .565, ax, ay, av, av);
      } else {
        const sc = Math.max(av / logo.width, av / logo.height);
        ctx.drawImage(logo, ax + (av - logo.width * sc) / 2, ay + (av - logo.height * sc) / 2, logo.width * sc, logo.height * sc);
      }
      ctx.restore();
    }
    const nx = logo ? pad + 78 + 24 : pad;
    ctx.fillStyle = '#fff'; ctx.font = `700 40px ${FONT}`; ctx.textBaseline = 'middle';
    ctx.fillText(wrap(ctx, opts.storeName, W - nx - pad, 1)[0] ?? '', nx, 48);
    ctx.font = `500 24px ${FONT}`; ctx.fillText('สินค้าพร้อมขาย', nx, 88);
    const page = items.slice(pageIndex * perPage, (pageIndex + 1) * perPage);
    page.forEach((item, i) => {
      const row = Math.floor(i / cols), col = i % cols;
      const x = gridLeft + col * (cardW + gap);
      const y = gridTop + row * (cardH + gap);
      const radius = Math.min(16, cardW * .08);
      ctx.fillStyle = opts.cardColor ?? theme.card?.fill ?? '#fff';
      ctx.beginPath(); ctx.roundRect(x, y, cardW, cardH, radius); ctx.fill();
      ctx.strokeStyle = opts.cardStroke ?? theme.card?.stroke ?? '#D6E4EF'; ctx.lineWidth = 1;
      ctx.stroke();
      const image = item.image ? images.get(item.image) : null;
      if (image) {
        // inset: fraction of the shorter edge so the image has breathing room inside the card
        const insetFrac = opts.imgSize === 'xs' ? 0.22 : opts.imgSize === 'small' ? 0.14 : opts.imgSize === 'large' ? 0.03 : 0.07;
        const insetX = cardW * insetFrac;
        const insetY = imageH * insetFrac;
        const zoneW = cardW - insetX * 2;
        const zoneH = imageH - insetY * 2;
        // Contain the image inside the zone (like CSS object-fit: contain)
        const imgScale = Math.min(zoneW / image.width, zoneH / image.height);
        const dw = image.width * imgScale, dh = image.height * imgScale;
        const dx = x + (cardW - dw) / 2;
        const dyBase = y + insetY + (zoneH - dh) / 2;
        const dy = opts.imgPosition === 'top' ? y + insetY : opts.imgPosition === 'bottom' ? y + imageH - insetY - dh : dyBase;
        ctx.save();
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(image, dx, dy, dw, dh);
        ctx.restore();
      }
      const inner = Math.min(16, cardW * .06), width = cardW - inner * 2;
      // Find the largest font size that fits the name on one line
      let actualNameF = nameF;
      ctx.font = `600 ${actualNameF}px ${FONT}`;
      while (actualNameF > 10 && ctx.measureText(item.name).width > width) {
        actualNameF--;
        ctx.font = `600 ${actualNameF}px ${FONT}`;
      }
      const lines = wrap(ctx, item.name, width, 1);  // single line, truncates with …
      // Pre-calculate pill height so priceRowH can accommodate it
      const label = `${num(item.stock)} ${opts.unit}`;
      const pillLeft = opts.pillPosition === 'left';
      const stockWidth = opts.showStock ? width * .44 : 0;
      const priceWidth = width - stockWidth - (opts.showStock ? 8 : 0);
      let pf = priceF;
      const text = `${opts.showBahtSymbol === false ? '' : '฿'}${new Intl.NumberFormat('th-TH', { minimumFractionDigits: opts.priceDecimal ?? 0, maximumFractionDigits: opts.priceDecimal ?? 2 }).format(item.price)}`;
      ctx.font = `700 ${pf}px ${FONT}`;
      // Only auto-shrink price when not manually overridden
      if (!opts.priceFontSize) {
        while (pf > 12 && ctx.measureText(text).width > priceWidth) { pf--; ctx.font = `700 ${pf}px ${FONT}`; }
      }
      let sf = opts.showStock ? (opts.stockFontSize ? stockF : Math.min(stockF, pf * .78)) : 0;
      if (opts.showStock && !opts.stockFontSize) {
        ctx.font = `700 ${sf}px ${FONT}`;
        while (sf > 10 && ctx.measureText(label).width + 16 > stockWidth) { sf--; ctx.font = `700 ${sf}px ${FONT}`; }
      }
      const sh = opts.showStock ? sf + 16 : 0;
      // Row height must fit both price text and pill
      const priceRowH = Math.max(pf * 1.2, sh);
      const nameBlockH = lines.length * actualNameF * 1.3;
      const textBlockH = nameBlockH + 10 + priceRowH;
      // Clamp: if text block exceeds infoH, center it anyway (content overflows visibly)
      const textTop = y + imageH + Math.max(0, (infoH - textBlockH) / 2);
      ctx.fillStyle = opts.nameColor ?? theme.name;
      const align = opts.textAlign ?? 'center'; ctx.textAlign = align; ctx.textBaseline = 'top';
      const tx = align === 'left' ? x + inner : align === 'right' ? x + cardW - inner : x + cardW / 2;
      lines.forEach((line, j) => ctx.fillText(line, tx, textTop + j * actualNameF * 1.3, width));
      // Baseline = vertical center of price row
      const baseline = textTop + nameBlockH + 10 + priceRowH / 2;
      const px = x + inner + (pillLeft && opts.showStock ? stockWidth + 8 : 0);
      ctx.font = `700 ${pf}px ${FONT}`;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = opts.priceColor ?? theme.price;
      ctx.fillText(text, px, baseline, priceWidth);
      const measuredPriceWidth = ctx.measureText(text).width;
      if (opts.showStock) {
        ctx.font = `700 ${sf}px ${FONT}`;
        const sw = Math.min(stockWidth, ctx.measureText(label).width + 16);
        const sx = pillLeft ? x + inner : opts.pillPosition === 'inline' ? px + Math.min(priceWidth, measuredPriceWidth) + 8 : x + cardW - inner - sw;
        const pillX = Math.min(sx, x + cardW - inner - sw);
        ctx.fillStyle = opts.pillBg ?? '#FACC15';
        ctx.beginPath(); ctx.roundRect(pillX, baseline - sh / 2, sw, sh, sh / 2); ctx.fill();
        // Use actual glyph bounds to find true visual center — Thai script sits
        // higher than its mathematical middle, so we nudge the draw point down.
        ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'center'; ctx.fillStyle = opts.pillFg ?? '#713F12';
        const m = ctx.measureText(label);
        const glyphH = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
        const textY = baseline - glyphH / 2 + m.actualBoundingBoxAscent;
        ctx.fillText(label, pillX + sw / 2, textY);
      }
      ctx.textAlign = 'left';
    });
    ctx.textBaseline = 'middle'; ctx.fillStyle = '#0369A1'; ctx.font = `600 26px ${FONT}`;
    ctx.fillText(wrap(ctx, opts.footer.trim(), W - pad * 2, 1)[0] ?? '', pad, H - 40);
    return canvas;
  });
}

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
const C = { sky: '#0EA5E9', skyDeep: '#0369A1', skySoft: '#E0F2FE', sun: '#FACC15', sunInk: '#422006', ink: '#0C1E33', muted: '#3B5470', bg: '#F0F9FF', line: '#BAE6FD' };

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

function pill(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string) {
  ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.fill();
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
    ctx.textBaseline = 'alphabetic';

    // Background
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, SIZE, SIZE);

    // Header band
    const headH = 176;
    const grad = ctx.createLinearGradient(0, 0, SIZE, 0);
    grad.addColorStop(0, C.skyDeep); grad.addColorStop(1, C.sky);
    ctx.fillStyle = grad; ctx.fillRect(0, 0, SIZE, headH);
    ctx.fillStyle = C.sun; ctx.fillRect(0, headH, SIZE, 10);

    const logoS = 104, logoX = 48, logoY = (headH - logoS) / 2;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(logoX, logoY, logoS, logoS, 26); ctx.fill();
    if (logo) {
      ctx.save(); ctx.beginPath(); ctx.roundRect(logoX + 4, logoY + 4, logoS - 8, logoS - 8, 22); ctx.clip();
      drawContain(ctx, logo, logoX + 4, logoY + 4, logoS - 8); ctx.restore();
    } else {
      ctx.fillStyle = C.sun; ctx.beginPath(); ctx.roundRect(logoX + 4, logoY + 4, logoS - 8, logoS - 8, 22); ctx.fill();
      ctx.fillStyle = C.sunInk; ctx.font = `700 46px ${FONT}`; ctx.textAlign = 'center';
      ctx.fillText([...opts.storeName.trim()][0] ?? '★', logoX + logoS / 2, logoY + logoS / 2 + 16); ctx.textAlign = 'left';
    }
    const textX = logoX + logoS + 28;
    const rightLimit = SIZE - 48 - (pages.length > 1 ? 120 : 0);
    ctx.fillStyle = '#fff'; ctx.font = `700 50px ${FONT}`;
    ctx.fillText(wrap(ctx, opts.storeName, rightLimit - textX, 1)[0] ?? '', textX, 86);
    ctx.fillStyle = C.skySoft; ctx.font = `500 28px ${FONT}`;
    ctx.fillText(wrap(ctx, `${opts.title} · ${date}`, rightLimit - textX, 1)[0] ?? '', textX, 132);
    if (pages.length > 1) {
      const label = `${pageIndex + 1}/${pages.length}`;
      ctx.font = `700 26px ${FONT}`;
      const w = ctx.measureText(label).width + 36;
      pill(ctx, SIZE - 48 - w, headH / 2 - 24, w, 48, C.sun);
      ctx.fillStyle = C.sunInk; ctx.textAlign = 'center'; ctx.fillText(label, SIZE - 48 - w / 2, headH / 2 + 9); ctx.textAlign = 'left';
    }

    // Footer
    const footH = opts.footer.trim() ? 84 : 32;
    if (opts.footer.trim()) {
      ctx.fillStyle = C.skyDeep; ctx.font = `600 30px ${FONT}`; ctx.textAlign = 'center';
      ctx.fillText(wrap(ctx, opts.footer.trim(), SIZE - 96, 1)[0] ?? '', SIZE / 2, SIZE - 36); ctx.textAlign = 'left';
    }

    // Grid
    const n = page.length;
    const cols = opts.perPage <= 4 ? 2 : opts.perPage <= 9 ? 3 : 4;
    const rows = Math.max(1, Math.ceil(n / cols));
    const pad = 40, gap = 20;
    const top = headH + 10 + 30, bottom = SIZE - footH;
    const cardW = (SIZE - pad * 2 - gap * (cols - 1)) / cols;
    // Same card size on every page of a multi-page set; a single page fills the space it has.
    const rowsForSize = pages.length > 1 ? Math.ceil(opts.perPage / cols) : rows;
    const cardH = Math.min((bottom - top - gap * (rowsForSize - 1)) / rowsForSize, cardW * 1.25);
    const gridH = rows * cardH + (rows - 1) * gap;
    const startY = top + Math.max(0, (bottom - top - gridH) / 2);

    // Size everything from the card height, then let the picture take whatever space is left on top.
    const base = Math.min(cardH, cardW * 1.1);
    const inner = Math.max(10, base * 0.06);
    const nameF = Math.min(40, Math.max(15, base * 0.07));
    const priceF = Math.min(60, Math.max(20, base * 0.11));
    const stockF = Math.min(28, Math.max(13, base * 0.055));
    const pillH = opts.showStock ? stockF * 1.9 : 0;
    const nameH = nameF * 1.25 * 2;
    const below = nameH + priceF * 1.15 + (opts.showStock ? base * 0.03 + pillH : 0);
    const imgS = Math.max(32, Math.min(cardW - inner * 2, cardH - inner * 2 - base * 0.03 - below));

    page.forEach((item, i) => {
      const r = Math.floor(i / cols), c = i % cols;
      const inRow = r === rows - 1 ? n - r * cols : cols;
      const rowOffset = (cols - inRow) * (cardW + gap) / 2; // centre a short last row
      const x = pad + rowOffset + c * (cardW + gap);
      const y = startY + r * (cardH + gap);

      ctx.fillStyle = '#fff'; ctx.strokeStyle = C.line; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(x, y, cardW, cardH, Math.min(24, base * 0.09)); ctx.fill(); ctx.stroke();

      const imgX = x + (cardW - imgS) / 2, imgY = y + inner + Math.max(0, (cardH - inner * 2 - base * 0.03 - below - imgS) / 2);
      const img = item.image ? images.get(item.image) : null;
      if (img) drawContain(ctx, img, imgX, imgY, imgS);
      else { ctx.fillStyle = C.skySoft; ctx.beginPath(); ctx.roundRect(imgX, imgY, imgS, imgS, 16); ctx.fill(); }

      // Text block is anchored to the card bottom so every card lines up.
      const bottomY = y + cardH - inner;
      let ty = bottomY - below;
      ctx.fillStyle = C.ink; ctx.font = `600 ${nameF}px ${FONT}`; ctx.textAlign = 'center';
      const lines = wrap(ctx, item.name, cardW - inner * 2, 2);
      const nameTop = ty + (lines.length === 1 ? nameF * 0.625 : 0);
      lines.forEach((line, li) => ctx.fillText(line, x + cardW / 2, nameTop + nameF * 0.95 + li * nameF * 1.25));
      ty += nameH;

      ctx.fillStyle = C.skyDeep; ctx.font = `800 ${priceF}px ${FONT}`;
      ctx.fillText(money(item.price), x + cardW / 2, ty + priceF * 0.92);
      ty += priceF * 1.15 + base * 0.03;

      if (opts.showStock) {
        ctx.font = `700 ${stockF}px ${FONT}`;
        const label = `เหลือ ${num(item.stock)} ${opts.unit}`;
        const w = Math.min(cardW - inner * 2, ctx.measureText(label).width + stockF * 1.6);
        pill(ctx, x + (cardW - w) / 2, ty, w, pillH, C.sun);
        ctx.fillStyle = C.sunInk; ctx.fillText(label, x + cardW / 2, ty + pillH / 2 + stockF * 0.36);
      }
      ctx.textAlign = 'left';
    });
    return canvas;
  });
}

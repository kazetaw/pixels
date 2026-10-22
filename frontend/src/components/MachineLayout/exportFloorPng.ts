import type { Machine } from '../../types';

type Floor = { id: number; slots: (string | null)[] };

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const image = new Image();
    const timer = window.setTimeout(() => resolve(null), 10000);
    image.crossOrigin = 'anonymous';
    image.onload = () => { clearTimeout(timer); resolve(image); };
    image.onerror = () => { clearTimeout(timer); resolve(null); };
    image.src = url;
  });
}

/** Render the selected layout directly to a high-resolution A4 landscape PNG. */
export async function exportFloorPng(floors: Floor[], machines: Machine[], mode: string) {
  if (!floors.length) throw new Error('ยังไม่มีชั้นให้ส่งออก');
  await document.fonts.ready;
  const sorted = [...floors].sort((a, b) => a.id - b.id);
  const catalog = new Map(machines.map(machine => [machine.machine_id, machine]));
  const ids = [...new Set(sorted.flatMap(floor => floor.slots.filter((id): id is string => !!id)))];
  const images = new Map(await Promise.all(ids.map(async id => [id, catalog.get(id)?.image ? await loadImage(catalog.get(id)!.image!) : null] as const)));
  const canvas = document.createElement('canvas');
  canvas.width = 3370; canvas.height = 2383;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('เบราว์เซอร์ไม่รองรับการสร้างรูป');
  ctx.scale(canvas.width / 1123, canvas.height / 794);
  ctx.fillStyle = '#fcfcfa'; ctx.fillRect(0, 0, 1123, 794);
  const text = (value: string, x: number, y: number, size: number, color = '#263e46', bold = false) => {
    ctx.fillStyle = color; ctx.font = `${bold ? '700' : '400'} ${size}px Tahoma, Arial, sans-serif`;
    ctx.fillText(value, x, y);
  };
  const fitText = (value: string, x: number, y: number, width: number, size: number) => {
    ctx.font = `400 ${size}px Tahoma, Arial, sans-serif`;
    // Wrapping keeps Thai machine names intact, including names without spaces.
    let line = ''; let row = 0;
    for (const char of value) {
      if (ctx.measureText(line + char).width > width && line) {
        if (row === 1) {
          while (line && ctx.measureText(line + '…').width > width) line = line.slice(0, -1);
          text(line + '…', x, y + row * (size + 2), size); return;
        }
        text(line, x, y + row * (size + 2), size); row++; line = '';
      }
      line += char;
    }
    if (line) text(line, x, y + row * (size + 2), size);
  };
  const title = mode === 'craft' ? 'ตอนคราฟ' : 'ตอนแข่งจริง';
  text('ผังเครื่องประจำชั้น', 32, 55, 27, '#203c47', true);
  text(`${sorted.length} ชั้น · ชั้นละ 12 เครื่อง`, 32, 80, 12, '#788687');
  ctx.fillStyle = '#203c47'; ctx.beginPath(); ctx.roundRect(936, 34, 155, 38, 19); ctx.fill();
  ctx.textAlign = 'center'; text(title, 1013, 59, 14, '#ffffff', true); ctx.textAlign = 'left';
  ctx.fillStyle = '#243d48'; ctx.fillRect(32, 97, 1059, 2);
  const perColumn = Math.ceil(sorted.length / 3);
  for (let column = 0; column < 3; column++) {
    const entries = sorted.slice(column * perColumn, (column + 1) * perColumn);
    if (!entries.length) continue;
    const x = 32 + column * 360;
    ctx.fillStyle = '#e6eeeb'; ctx.fillRect(x, 113, 339, 28);
    text(`ชั้น ${entries[0].id}–${entries[entries.length - 1].id}`, x + 10, 132, 12, '#355c56', true);
    const grouped = entries.map(floor => {
      const groups = new Map<string, number>();
      floor.slots.forEach(id => { if (id) groups.set(id, (groups.get(id) ?? 0) + 1); });
      return { floor, groups: [...groups] };
    });
    const weights = grouped.map(({ groups }) => Math.max(1, Math.ceil(groups.length / 3)));
    const unit = Math.min(56, 560 / weights.reduce((sum, value) => sum + value, 0));
    let y = 145;
    grouped.forEach(({ floor, groups }, index) => {
      const height = weights[index] * unit;
      if (index % 2) { ctx.fillStyle = '#f0f4f1'; ctx.fillRect(x, y, 339, height); }
      text(String(floor.id).padStart(2, '0'), x + 8, y + 32, Math.min(21, unit * .5), '#57726e', true);
      if (!groups.length) text('ชั้นว่าง', x + 48, y + 32, 12, '#8b9690');
      groups.forEach(([id, count], groupIndex) => {
        const single = groups.length === 1;
        const gx = x + 46 + (single ? 0 : groupIndex % 3 * 96);
        const gy = y + (single ? 0 : Math.floor(groupIndex / 3) * unit);
        const size = Math.max(4, Math.min(single ? 42 : 24, single ? unit - 10 : unit * .43));
        const image = images.get(id);
        if (image) {
          const scale = Math.min(size / image.naturalWidth, size / image.naturalHeight);
          const w = image.naturalWidth * scale, h = image.naturalHeight * scale;
          ctx.drawImage(image, gx + (size - w) / 2, gy + 5 + (size - h) / 2, w, h);
        } else { text('◇', gx + 5, gy + 26, 22, '#57726e'); }
        const name = catalog.get(id)?.machine_name ?? id;
        if (single) {
          fitText(name, gx + size + 8, gy + 25, 185, 11);
          text(`×${count}`, x + 298, gy + 32, 16, '#26493f', true);
        } else {
          text(`×${count}`, gx + size + 4, gy + 22, 12, '#26493f', true);
          fitText(name, gx, gy + size + 12, 90, Math.min(8, unit / 8));
        }
      });
      ctx.fillStyle = '#e3e9e5'; ctx.fillRect(x, y + height - 1, 339, 1);
      y += height;
    });
  }
  ctx.fillStyle = '#d7e2db'; ctx.fillRect(32, 724, 1059, 1);
  text('อ่านเรียงลงตามเลขชั้น จากคอลัมน์ซ้ายไปขวา', 32, 745, 10, '#7b8b84');
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('สร้าง PNG ไม่สำเร็จ')), 'image/png'));
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url;
  link.download = `ผังเครื่อง-${title}-${new Date().toISOString().slice(0, 10)}.png`;
  link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  return { missingImages: ids.filter(id => !images.get(id)).length };
}

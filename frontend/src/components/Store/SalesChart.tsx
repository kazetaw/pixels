import { useId, useMemo, useState, type PointerEvent } from 'react';

type Sale = { total: number; sold_at: string };
const DAYS = 14;
const W = 640, H = 200, PAD_T = 12, PAD_B = 24;

function dayKey(d: Date) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }

/** Daily revenue for the last DAYS days (local time), oldest first, empty days = 0. */
export function dailyTotals(sales: Sale[], now = new Date()) {
  const days = Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (DAYS - 1 - i));
    return { date: d, key: dayKey(d), total: 0 };
  });
  const byKey = new Map(days.map(d => [d.key, d]));
  for (const s of sales) { const d = byKey.get(dayKey(new Date(s.sold_at))); if (d) d.total += Number(s.total); }
  return days;
}

/** Single-series area chart (WattVision: cyan line, cyan→green area, #2C2C2E grid) with a crosshair tooltip. */
export function SalesChart({ sales, fmtMoney }: { sales: Sale[]; fmtMoney: (n: number) => string }) {
  const gradId = useId();
  const [hover, setHover] = useState<number | null>(null);
  const days = useMemo(() => dailyTotals(sales), [sales]);
  const max = Math.max(...days.map(d => d.total), 1);
  const x = (i: number) => (i / (DAYS - 1)) * W;
  const y = (v: number) => PAD_T + (1 - v / max) * (H - PAD_T - PAD_B);
  const line = days.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d.total)}`).join('');
  const area = `${line}L${W},${H - PAD_B}L0,${H - PAD_B}Z`;
  const label = (d: Date) => d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
  const h = hover === null ? null : days[hover];

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setHover(Math.round(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * (DAYS - 1)));
  };

  return (
    <div className="shop-chart" onPointerMove={onMove} onPointerLeave={() => setHover(null)}
      role="img" aria-label={`ยอดขายรายวัน ${DAYS} วันล่าสุด รวม ${fmtMoney(days.reduce((s, d) => s + d.total, 0))}`}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FACC15" stopOpacity=".45" />
            <stop offset="100%" stopColor="#0EA5E9" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, .25, .5, .75, 1].map(t => <line key={t} className="shop-chart__grid" x1="0" x2={W} y1={y(max * t)} y2={y(max * t)} />)}
        <path d={area} fill={`url(#${gradId})`} />
        <path d={line} className="shop-chart__line" />
        {h && hover !== null && <>
          <line className="shop-chart__cross" x1={x(hover)} x2={x(hover)} y1={PAD_T} y2={H - PAD_B} />
          <circle className="shop-chart__dot" cx={x(hover)} cy={y(h.total)} r="4" />
        </>}
      </svg>
      <div className="shop-chart__axis"><span>{label(days[0].date)}</span><span>{label(days[DAYS >> 1].date)}</span><span>วันนี้</span></div>
      <div className="shop-chart__max">{fmtMoney(max)}</div>
      {h && hover !== null && (
        <div className="shop-chart__tip" style={{ left: `${(hover / (DAYS - 1)) * 100}%`, transform: `translateX(${hover > DAYS / 2 ? '-105%' : '5%'})` }}>
          <strong>{fmtMoney(h.total)}</strong><span>{label(h.date)}</span>
        </div>
      )}
    </div>
  );
}

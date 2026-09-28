export function daysUntil(deadline: string, now = new Date()): number {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  return Math.max(0, Math.round((Date.parse(`${deadline}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000));
}
export function dailyTargets(rows: { item_id: string; target: number }[], stocks: Record<string, number>, days: number) {
  const totals = new Map<string, number>();
  for (const row of rows) totals.set(row.item_id, (totals.get(row.item_id) ?? 0) + row.target);
  return [...totals].map(([id, target]) => {
    const stock = stocks[id] ?? 0;
    const remaining = Math.max(0, target - stock);
    return { id, target, stock, remaining, daily: days > 0 ? Math.ceil(remaining / days) : null };
  });
}

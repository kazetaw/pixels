/**
 * api/lib/time.ts — ported from backend/src/utils/time.ts
 */

export function parseTimeToHours(time: string | null | undefined): number {
  if (!time) return 0;
  const parts = time.split(':');
  if (parts.length !== 3) return 0;
  const [h, m, s] = parts.map(Number);
  if ([h, m, s].some(isNaN)) return 0;
  return h + m / 60 + s / 3600;
}

export function hoursToTimeString(hours: number): string {
  const totalSeconds = Math.round(hours * 3600);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

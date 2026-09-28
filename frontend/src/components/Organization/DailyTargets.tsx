import { useEffect, useState } from 'react';
import { daysUntil } from './dailyTargetMath';
export function DailyTargets({ onDaysChange }: { onDaysChange: (days: number | null) => void }) {
  const [now, setNow] = useState(new Date());
  const days = daysUntil('2026-10-29', now);
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 60000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { onDaysChange(days); }, [days, onDaysChange]);
  return <section className="org-daily-targets"><h3>เตรียมของก่อน 29 ตุลาคม 2569</h3><p>{days > 0 ? `เหลือ ${days} วันผลิต` : 'ถึงหรือเลยวันครบกำหนดแล้ว'} · นับวันประเทศไทย ไม่รวมวันแข่ง · ดูขั้นต่ำข้างเป้าของแต่ละคน</p></section>;
}

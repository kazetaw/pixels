import { useEffect, useState } from 'react';
import { Alert, Button, Input } from 'antd';
import { ItemLabel } from '../shared/ItemVisual';
import { dailyTargets, daysUntil } from './dailyTargetMath';
import type { ContributorAssignment } from '../../api/client';

export function DailyTargets({ assignments, stocks, itemNames }: { assignments: ContributorAssignment[]; stocks: Record<string, number>; itemNames: Record<string, string> }) {
  const [deadline, setDeadline] = useState('');
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(new Date());
  const [loaded, setLoaded] = useState(false);
  async function request(method: 'GET' | 'PUT') {
    const res = await fetch('/api/assignments/deadline', method === 'PUT' ? { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deadline: draft }) } : undefined);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'โหลดวันครบกำหนดไม่สำเร็จ');
    setDeadline(data.deadline ?? ''); setDraft(data.deadline ?? ''); setLoaded(true);
  }
  useEffect(() => {
    void request('GET').catch(e => setError(e.message));
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  const days = deadline ? daysUntil(deadline, now) : 0;
  const rows = dailyTargets(assignments, stocks, days);
  return <section className="org-daily-targets" aria-label="ขั้นต่ำที่ต้องเติมต่อวัน">
    <h3>เตรียมของให้ทันวันแข่ง</h3>
    <p>ยอดรวมทีมต่อสินค้า · รวมเป้าของทุกคนแล้วหักสต็อกครั้งเดียว · งานฟาร์ม ∞ ไม่รวมในเป้าหมาย</p>
    <div className="org-deadline-form"><label>วันแข่ง / วันครบกำหนด<Input type="date" aria-label="วันครบกำหนด" value={draft} onChange={e => setDraft(e.target.value)} /></label>
      <Button type="primary" loading={busy} disabled={!draft || draft === deadline} onClick={async () => {
        setBusy(true); setError('');
        try { await request('PUT'); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
      }}>บันทึกวันร่วมกัน</Button>
    </div>
    {error && <Alert type="error" message="ยังโหลดหรือบันทึกวันครบกำหนดไม่ได้" description={error} />}
    {loaded && !deadline && <p>เลือกวันครบกำหนดเพื่อคำนวณขั้นต่ำต่อวัน</p>}
    {deadline && <><p><strong>{days > 0 ? `เหลือ ${days} วันผลิต` : 'ถึงหรือเลยวันครบกำหนดแล้ว'}</strong> · นับตามวันประเทศไทย ไม่รวมวันครบกำหนด</p>
      <div className="org-daily-list">{rows.map(row => <article key={row.id}>
        <ItemLabel id={row.id} name={itemNames[row.id] || 'ไม่พบชื่อสินค้า'} size={36} reserveImage />
        <div>คลัง {row.stock.toLocaleString()} / เป้ารวม {row.target.toLocaleString()} ชิ้น</div>
        <div>ยังขาด <strong>{row.remaining.toLocaleString()}</strong> ชิ้น</div>
        <strong>{!row.remaining ? 'ครบเป้าแล้ว' : row.daily === null ? 'ต้องเติมให้ครบโดยเร็ว' : `ขั้นต่ำ ${row.daily.toLocaleString()} ชิ้น/วัน`}</strong>
        {!!row.remaining && row.daily !== null && <small>{Math.floor(row.daily / 99).toLocaleString()} กอง + {row.daily % 99} ชิ้น / วัน</small>}
      </article>)}</div>
    </>}
  </section>;
}

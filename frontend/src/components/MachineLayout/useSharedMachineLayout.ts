import { useEffect, useRef, useState } from 'react';
import { useLocalStorage } from '../../hooks/useLocalStorage';
export type MachineLayoutData = { owned: Record<string, number>; floors: { id: number; slots: (string | null)[] }[] };
export function useSharedMachineLayout() {
  const [layout, setLayout] = useLocalStorage<MachineLayoutData>('machine-layout-v1', { owned: {}, floors: [{ id: 1, slots: Array(12).fill(null) }] });
  const [status, setStatus] = useState('กำลังโหลดผังส่วนกลาง…');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [retry, setRetry] = useState(0);
  const revision = useRef(0);
  const saved = useRef('');
  const latest = useRef(layout);
  latest.current = layout;
  useEffect(() => {
    let active = true;
    setReady(false); setError('');
    fetch('/api/machine-layout').then(async r => { const data = await r.json(); if (!r.ok) throw new Error(data.error); return data; }).then(row => {
      if (!active) return;
      revision.current = row?.revision ?? 0;
      saved.current = row ? JSON.stringify(row.data) : '';
      if (row) setLayout(row.data);
      setReady(true); setStatus(row ? 'โหลดผังส่วนกลางแล้ว' : 'กำลังนำผังในเบราว์เซอร์ขึ้นส่วนกลาง…');
    }).catch(e => { if (active) setError(e.message || 'โหลดผังไม่ได้'); });
    return () => { active = false; };
  }, [retry, setLayout]);
  useEffect(() => {
    if (!ready) return;
    let active = true;
    let saving = false;
    const save = async () => {
      const body = JSON.stringify(latest.current);
      if (saving || body === saved.current) return;
      saving = true; setStatus('กำลังบันทึก…');
      try {
        const response = await fetch('/api/machine-layout', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: JSON.parse(body), revision: revision.current }) });
        const row = await response.json();
        if (!response.ok) throw new Error(row.error || 'บันทึกไม่ได้');
        if (!active) return;
        revision.current = row.revision; saved.current = body;
        setStatus('บันทึกใน Supabase แล้ว');
      } catch (e) {
        if (active) { setError((e as Error).message); setReady(false); }
      } finally { saving = false; }
    };
    const timer = window.setInterval(() => { void save(); }, 700);
    return () => { active = false; window.clearInterval(timer); };
  }, [ready]);
  return { layout, setLayout, status, error, ready, reload: () => setRetry(n => n + 1) };
}

import { useEffect, useRef, useState } from 'react';
import { useLocalStorage } from '../../hooks/useLocalStorage';
export type MachineLayoutData = { owned: Record<string, number>; competitionFloors?: { id: number; slots: (string | null)[] }[]; floors: { id: number; slots: (string | null)[] }[] };
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

  // ── Initial load ─────────────────────────────────────────────────────────
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

  // ── Poll every 5s to catch remote changes ────────────────────────────────
  useEffect(() => {
    if (!ready) return;
    let active = true;
    const poll = async () => {
      try {
        const r = await fetch('/api/machine-layout');
        if (!r.ok || !active) return;
        const row = await r.json();
        if (!active || !row) return;
        // Only apply if someone else changed it (different revision)
        if (row.revision > revision.current) {
          const bodyStr = JSON.stringify(latest.current);
          // If we have unsaved local changes, skip — save loop will handle conflict
          if (bodyStr === saved.current) {
            revision.current = row.revision;
            saved.current = JSON.stringify(row.data);
            setLayout(row.data);
            setStatus(`ผังถูกอัพเดตโดยคนอื่น · บันทึกล่าสุด ${new Date(row.updated_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.`);
          }
        }
      } catch { /* silent */ }
    };
    const timer = window.setInterval(() => void poll(), 5_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [ready, setLayout]);

  // ── Auto-save loop ────────────────────────────────────────────────────────
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
        if (!active) return;
        if (response.status === 409) {
          // Conflict: someone else saved first → reload their version, discard our pending change
          setStatus('⚠️ มีคนแก้ผังก่อน กำลังโหลดผังล่าสุด…');
          const r2 = await fetch('/api/machine-layout');
          const latest2 = await r2.json();
          if (!active) return;
          revision.current = latest2.revision;
          saved.current = JSON.stringify(latest2.data);
          setLayout(latest2.data);
          setStatus('โหลดผังล่าสุดแล้ว — การเปลี่ยนแปลงก่อนหน้าถูกยกเลิก กรุณาทำใหม่');
          setError('มีคนแก้ผังก่อนหน้านี้ ผังถูกรีเซ็ตเป็นเวอร์ชันล่าสุด');
          return;
        }
        if (!response.ok) throw new Error(row.error || 'บันทึกไม่ได้');
        revision.current = row.revision; saved.current = body;
        setStatus('บันทึกใน Supabase แล้ว'); setError('');
      } catch (e) {
        if (active) { setError((e as Error).message); setReady(false); }
      } finally { saving = false; }
    };
    const timer = window.setInterval(() => { void save(); }, 700);
    return () => { active = false; window.clearInterval(timer); };
  }, [ready, setLayout]);

  return { layout, setLayout, status, error, ready, reload: () => setRetry(n => n + 1) };
}

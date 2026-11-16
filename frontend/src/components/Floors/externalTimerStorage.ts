import type { FloorTimer } from '../../types';

export const EXTERNAL_TIMER_PREFIX = 'pixel-external-timer-v1:';

// One key per timer keeps edits to different timers in separate tabs independent.
export function readExternalTimers(storage: Storage = localStorage): FloorTimer[] {
  const timers: FloorTimer[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key?.startsWith(EXTERNAL_TIMER_PREFIX)) continue;
    const timer = JSON.parse(storage.getItem(key) ?? 'null') as FloorTimer | null;
    if (!timer || !Number.isSafeInteger(timer.floor_number) || typeof timer.name !== 'string'
      || !['idle', 'running'].includes(timer.status) || !Number.isFinite(timer.estimated_duration_seconds)
      || timer.estimated_duration_seconds < 0
      || (timer.status === 'running' && !Number.isFinite(Date.parse(timer.start_time ?? '')))) {
      throw new Error('ข้อมูลเครื่องนอกในเบราว์เซอร์อ่านไม่ได้ กรุณาตรวจข้อมูลที่บันทึกไว้');
    }
    timers.push(timer);
  }
  return timers.sort((a, b) => a.floor_number - b.floor_number);
}

function save(timer: FloorTimer, storage: Storage): FloorTimer {
  if (!timer.name?.trim() || timer.name.trim().length > 120) throw new Error('กรอกชื่อเครื่องนอกไม่เกิน 120 ตัวอักษร');
  timer.name = timer.name.trim();
  try { storage.setItem(EXTERNAL_TIMER_PREFIX + timer.floor_number, JSON.stringify(timer)); }
  catch { throw new Error('บันทึกเครื่องนอกไม่ได้ พื้นที่เบราว์เซอร์เต็มหรือปิดการจัดเก็บข้อมูล'); }
  return timer;
}

export function createExternalTimer(patch: Partial<FloorTimer>, storage: Storage = localStorage): FloorTimer {
  let id: number;
  do {
    const words = crypto.getRandomValues(new Uint32Array(2));
    id = (words[0] & 0xffff) * 0x100000000 + words[1];
  } while (storage.getItem(EXTERNAL_TIMER_PREFIX + id) !== null);
  return save({
    ...patch, floor_number: id, name: patch.name, machine_id: patch.machine_id ?? null,
    recipe_id: patch.recipe_id ?? null, status: 'idle', start_time: null,
    estimated_duration_seconds: 0, completed_at: null,
  }, storage);
}

export function updateExternalTimer(id: number, patch: Partial<FloorTimer>, storage: Storage = localStorage): FloorTimer {
  const timer = readExternalTimers(storage).find(item => item.floor_number === id);
  if (!timer) throw new Error('ไม่พบเครื่องนอกนี้ กรุณาโหลดหน้าใหม่');
  return save({ ...timer, ...patch, floor_number: id }, storage);
}

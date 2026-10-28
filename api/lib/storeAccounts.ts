import type { SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
export type StoreCharacter = { name: string; id: string; category: 'มอน/ป่า' | 'คราฟ'; items: string[]; avatar: number; image_url: string | null };
export type StoreAccount = { email: string; characters: StoreCharacter[]; updated_at: string };
const BUCKET = 'store-account-documents';
export function validateAccount(body: unknown): Omit<StoreAccount, 'updated_at'> {
  const b = body as StoreAccount;
  if (!b || typeof b.email !== 'string' || !/^[^\s@]+@gmail\.com$/i.test(b.email.trim()) || b.email.length > 254) throw new Error('กรุณากรอก Gmail ให้ถูกต้อง');
  if (!Array.isArray(b.characters) || b.characters.length !== 3) throw new Error('แต่ละ Gmail ต้องมี 3 ตัวละคร');
  const characters = b.characters.map(c => {
    if (!c || typeof c.name !== 'string' || !c.name.trim() || c.name.length > 80 || typeof c.id !== 'string' || !c.id.trim() || c.id.length > 80) throw new Error('กรอกชื่อและ ID ของทั้ง 3 ตัวละคร');
    if (!['มอน/ป่า', 'คราฟ'].includes(c.category)) throw new Error('หมวดไม่ถูกต้อง');
    if (!Array.isArray(c.items) || !c.items.length || c.items.length > 50 || c.items.some(v => typeof v !== 'string' || !v.trim() || v.length > 100)) throw new Error('ระบุของที่เก็บให้ครบทุกตัวละคร');
    if (!Number.isInteger(c.avatar) || c.avatar < 0 || c.avatar > 5) throw new Error('Avatar ไม่ถูกต้อง');
    if (c.image_url !== null && (typeof c.image_url !== 'string' || c.image_url.length > 2048 || !/^https:\/\//.test(c.image_url))) throw new Error('URL รูปภาพไม่ถูกต้อง');
    return { name:c.name.trim(), id:c.id.trim(), category:c.category, items:[...new Set(c.items.map(v=>v.trim()))], avatar:c.avatar, image_url:c.image_url };
  });
  if (new Set(characters.map(c=>c.id)).size !== 3) throw new Error('ID ทั้ง 3 ตัวต้องไม่ซ้ำกัน');
  return { email:b.email.trim().toLowerCase(), characters };
}
export function accountKey(email: string) { return createHash('sha256').update(email.trim().toLowerCase()).digest('hex'); }
export async function accountBucket(db: SupabaseClient) {
  const { data, error } = await db.storage.getBucket(BUCKET);
  if (!data) {
    if (error && String((error as {status?:number}).status) !== '404' && !/not found/i.test(error.message)) throw error;
    const { error: created } = await db.storage.createBucket(BUCKET, { public:false, fileSizeLimit:262144, allowedMimeTypes:['application/json'] });
    if (created && !/already exists|duplicate/i.test(created.message)) throw created;
  }
  return db.storage.from(BUCKET);
}

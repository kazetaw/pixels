import type { FloorTimer } from '../../types';
export class AccountRequestError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export interface ExternalAccount { id: string; username: string }
export async function accountRequest<T>(path: string, method = 'GET', body?: unknown, owner?: string): Promise<T> {
  const response = await fetch(`/api/external-account/${path}`, {
    method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Pixel-Request': '1', ...(owner ? { 'X-Pixel-Account': owner } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401 && owner) window.dispatchEvent(new Event('external-session-expired'));
    throw new AccountRequestError(result.error || 'เชื่อมต่อบัญชีไม่สำเร็จ', response.status);
  }
  return result as T;
}
export const cloudTimers = {
  remove: (id: number, owner?: string) => accountRequest<{ ok: boolean }>(`timers/${id}`, 'DELETE', undefined, owner),
  read: (owner?: string) => accountRequest<FloorTimer[]>('timers', 'GET', undefined, owner),
  create: (timer: Partial<FloorTimer>, owner?: string) => accountRequest<FloorTimer>('timers', 'POST', timer, owner),
  update: (id: number, patch: Partial<FloorTimer>, owner?: string) => accountRequest<FloorTimer>(`timers/${id}`, 'PATCH', patch, owner),
};

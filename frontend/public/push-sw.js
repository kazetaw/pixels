/* Notification-only worker: never caches API responses or authenticated data. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { /* still show a visible notification */ }
  if (!payload || typeof payload !== 'object') payload = {};
  event.waitUntil(self.registration.showNotification(payload.title || 'เครื่องนอกผลิตเสร็จแล้ว', {
    body: payload.body || 'เปิดดูสถานะเครื่องนอกของคุณ',
    icon: '/favicon.png', badge: '/favicon.png',
    tag: payload.tag || 'external-machine',
    data: { url: payload.url || '/?externalTimer=0' },
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    let target;
    try { target = new URL(event.notification.data?.url || '/', self.location.origin); }
    catch { target = new URL('/', self.location.origin); }
    if (target.origin !== self.location.origin) return;
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) { await existing.navigate(target.href); await existing.focus(); }
    else await self.clients.openWindow(target.href);
  })());
});

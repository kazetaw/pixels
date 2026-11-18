import { useEffect, useState } from 'react';
import { Alert, Button } from 'antd';
import { BellOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { accountRequest } from './externalAccountClient';

type Config = { available: boolean; publicKey: string | null };
const applicationKey = (value: string) => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4)), char => char.charCodeAt(0));
export function ExternalPushSettings({ accountId, cloud }: { accountId?: string; cloud: boolean }) {
  const [config, setConfig] = useState<Config>();
  const [registration, setRegistration] = useState<ServiceWorkerRegistration>();
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const installed = window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  const supported = window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  useEffect(() => {
    if (!accountId || !cloud || !supported || (ios && !installed)) return;
    let active = true;
    void (async () => {
      const settings = await accountRequest<Config>('push', 'GET', undefined, accountId);
      if (!active) return;
      setConfig(settings);
      if (!settings.available) return;
      const worker = await navigator.serviceWorker.register('/push-sw.js', { scope: '/' });
      // Wait until installed/activated; requestPermission is reserved for the user's click.
      const ready = await navigator.serviceWorker.ready;
      if (!active) return;
      setRegistration(ready || worker);
      const subscription = await ready.pushManager.getSubscription();
      if (subscription) {
        const status = await accountRequest<{ enabled: boolean }>('push', 'POST', { action: 'status', endpoint: subscription.endpoint }, accountId);
        if (active) setEnabled(status.enabled && Notification.permission === 'granted');
      }
    })().catch(e => { if (active) setError(e.message || 'ตรวจสอบการแจ้งเตือนไม่สำเร็จ'); });
    return () => { active = false; };
  }, [accountId, cloud, supported, ios, installed]);
  const toggle = async () => {
    if (!registration || !config?.publicKey || !accountId) return;
    setBusy(true); setError('');
    try {
      if (enabled) {
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await accountRequest('push', 'DELETE', { endpoint: subscription.endpoint }, accountId);
          await subscription.unsubscribe();
        }
        setEnabled(false);
      } else {
        // Must occur directly inside the user gesture on iOS.
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') throw new Error(permission === 'denied' ? 'การแจ้งเตือนถูกปิดอยู่ กรุณาอนุญาตในการตั้งค่าเว็บไซต์ของเบราว์เซอร์' : 'ยังไม่ได้อนุญาตการแจ้งเตือน');
        let subscription = await registration.pushManager.getSubscription();
        const key = applicationKey(config.publicKey);
        if (subscription?.options.applicationServerKey && new Uint8Array(subscription.options.applicationServerKey).toString() !== key.toString()) {
          await subscription.unsubscribe(); subscription = null;
        }
        subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
        await accountRequest('push', 'POST', { subscription: subscription.toJSON() }, accountId);
        setEnabled(true);
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'ตั้งค่าการแจ้งเตือนไม่สำเร็จ'); }
    finally { setBusy(false); }
  };
  const hint = !accountId ? 'เข้าสู่ระบบและใช้รายการในบัญชี เพื่อรับแจ้งเตือนเมื่อปิดเว็บ'
    : !cloud ? 'เลือก “บัญชีของฉัน” เพื่อเปิดแจ้งเตือน รายการในเครื่องยังใช้งานได้ตามเดิม'
    : ios && !installed ? 'iPhone / iPad: แชร์ → เพิ่มไปยังหน้าจอโฮม แล้วเปิดเว็บจากไอคอนนั้น (iOS 16.4 ขึ้นไป)'
    : !supported ? 'เบราว์เซอร์นี้ยังไม่รองรับ Push หรือไม่ได้เปิดผ่าน HTTPS'
    : config && !config.available ? 'ระบบส่งแจ้งเตือนกำลังรอการตั้งค่าจากผู้ดูแล'
    : enabled ? 'เปิดสำหรับอุปกรณ์นี้แล้ว · แจ้งเมื่อรายการในบัญชีผลิตเสร็จ แม้ปิดเว็บ'
    : 'รับแจ้งเตือนเมื่อรายการในบัญชีผลิตเสร็จบนอุปกรณ์นี้';
  return <section className="external-push-settings" aria-label="แจ้งเตือนเครื่องนอก">
    <div><strong>{enabled ? <CheckCircleOutlined /> : <BellOutlined />} แจ้งเตือนเมื่อผลิตเสร็จ</strong><p>{hint}</p></div>
    {accountId && cloud && supported && (!ios || installed) && config?.available && <Button size="small" loading={busy} disabled={!registration} onClick={() => void toggle()}>{enabled ? 'ปิดแจ้งเตือน' : 'เปิดแจ้งเตือน'}</Button>}
    {error && <Alert type="warning" showIcon message={error} />}
  </section>;
}

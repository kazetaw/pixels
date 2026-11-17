import './ExternalMachinesPage.css';
import { useEffect, useState } from 'react';
import { Alert, Button, Dropdown, Form, Input, Modal, Segmented, Skeleton, message } from 'antd';
import { CloudOutlined, LaptopOutlined, LoginOutlined, LogoutOutlined, DownOutlined, ImportOutlined, SafetyCertificateOutlined, CheckCircleFilled } from '@ant-design/icons';
import { FloorTimerDashboard } from './FloorTimerDashboard';
import { accountRequest, AccountRequestError, type ExternalAccount } from './externalAccountClient';
import { EXTERNAL_TIMER_PREFIX, readExternalTimers } from './externalTimerStorage';
import type { FloorTimer } from '../../types';

export function ExternalMachinesPage() {
  const [account, setAccount] = useState<ExternalAccount | null>(null);
  const [checking, setChecking] = useState(true);
  const [sessionError, setSessionError] = useState('');
  const [expired, setExpired] = useState(false);
  const [mode, setMode] = useState<'local' | 'cloud'>('local');
  const [authOpen, setAuthOpen] = useState(false);
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const [localTimers, setLocalTimers] = useState<FloorTimer[]>([]);
  const [localError, setLocalError] = useState('');
  const [importRows, setImportRows] = useState<FloorTimer[] | null>(null);
  const [imported, setImported] = useState(false);
  const [form] = Form.useForm<{ username: string; password: string; confirm?: string }>();
  const [msg, holder] = message.useMessage();
  const refreshLocal = () => {
    try { setLocalTimers(readExternalTimers()); setLocalError(''); }
    catch { setLocalError('อ่านข้อมูลเดิมในเครื่องไม่ได้ กรุณาลองใหม่ โดยข้อมูลเดิมยังไม่ถูกเปลี่ยนแปลง'); }
  };
  useEffect(() => {
    refreshLocal();
    const onStorage = (event: StorageEvent) => { if (!event.key || event.key.startsWith(EXTERNAL_TIMER_PREFIX)) refreshLocal(); };
    const onExpired = () => setExpired(true);
    window.addEventListener('focus', refreshLocal);
    window.addEventListener('storage', onStorage);
    window.addEventListener('external-session-expired', onExpired);
    return () => {
      window.removeEventListener('focus', refreshLocal);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('external-session-expired', onExpired);
    };
  }, []);
  const checkSession = async () => {
    setChecking(true); setSessionError('');
    try {
      const user = await accountRequest<ExternalAccount>('session');
      setAccount(user); setMode('cloud'); setExpired(false);
    } catch (e) {
      if (e instanceof AccountRequestError && e.status === 401) { setAccount(null); setMode('local'); }
      else setSessionError('เชื่อมต่อบัญชีไม่ได้ชั่วคราว ลองอีกครั้งเพื่อโหลดบัญชีเดิม');
    } finally { setChecking(false); }
  };
  useEffect(() => { void checkSession(); }, []);
  const openAuth = (signup = false) => { setRegister(signup); setAuthError(''); form.resetFields(); setAuthOpen(true); };
  const authenticate = async (values: { username: string; password: string }) => {
    setBusy(true); setAuthError('');
    try {
      const user = await accountRequest<ExternalAccount>(register ? 'register' : 'login', 'POST', { username: values.username.trim(), password: values.password });
      setAccount(user); setMode('cloud'); setAuthOpen(false); form.resetFields(); setNotice(''); setExpired(false); setSessionError(''); setImported(false); setRevision(v => v + 1); refreshLocal();
    } catch (e) { setAuthError((e as Error).message); }
    finally { setBusy(false); }
  };
  const previewImport = () => {
    try { setImportRows(readExternalTimers()); }
    catch (e) { msg.error((e as Error).message); }
  };
  const importLocal = async () => {
    if (!account || !importRows) return;
    setBusy(true);
    try {
      const result = await accountRequest<{ imported: number }>('import', 'POST', { timers: importRows }, account.id);
      setNotice(result.imported ? `นำเข้า ${result.imported} รายการแล้ว เปิดต่อบนอุปกรณ์อื่นด้วยบัญชี ${account.username} ได้เลย` : 'รายการทั้งหมดอยู่ในบัญชีแล้ว ไม่มีการเพิ่มซ้ำหรือเขียนทับ');
      setRevision(value => value + 1); setMode('cloud'); setImportRows(null); setImported(true);
    } catch (e) { msg.error((e as Error).message); }
    finally { setBusy(false); }
  };
  const logout = async () => {
    setBusy(true);
    try { await accountRequest('logout', 'POST'); setAccount(null); setMode('local'); setNotice(''); setExpired(false); refreshLocal(); }
    catch (e) { msg.error((e as Error).message); }
    finally { setBusy(false); }
  };
  if (checking) return <div className="external-account-loading"><Skeleton active title={{ width: 160 }} paragraph={{ rows: 2 }} /></div>;
  return <>
    {holder}
    {sessionError && <Alert type="warning" showIcon message={sessionError} action={<Button onClick={() => void checkSession()}>ลองอีกครั้ง</Button>} className="external-account-alert" />}
    {expired && <Alert type="warning" showIcon message="การเข้าสู่ระบบหมดอายุ ข้อมูลในบัญชียังอยู่ครบ" action={<Button onClick={() => openAuth()}>เข้าสู่ระบบอีกครั้ง</Button>} className="external-account-alert" />}
    <section className={`external-workspace ${account ? 'is-signed-in' : ''}`} aria-label="บัญชีและที่เก็บข้อมูล">
      <div className="external-workspace__top">
        <div className="external-workspace__identity">
          <span className="external-workspace__avatar" aria-hidden>{account ? account.username.slice(0, 2).toUpperCase() : <LaptopOutlined />}</span>
          <div><strong>{account ? account.username : 'พื้นที่ส่วนตัวในเครื่องนี้'}</strong>
            <p>{account ? <><CheckCircleFilled /> จำการเข้าสู่ระบบแล้ว</> : 'รายการเดิมยังอยู่ครบ ใช้ต่อได้ทันที'}</p>
          </div>
        </div>
        {account ? <Dropdown trigger={['click']} menu={{ items: [
          { key: 'import', label: 'นำเข้ารายการจากเครื่องนี้', icon: <ImportOutlined /> },
          { type: 'divider' },
          { key: 'logout', label: 'ออกจากระบบ', icon: <LogoutOutlined /> },
        ], onClick: ({ key }) => key === 'import' ? previewImport() : void logout() }}>
          <Button loading={busy} className="external-workspace__menu">บัญชี <DownOutlined /></Button>
        </Dropdown> : <div className="external-workspace__auth-actions">
          <Button onClick={() => openAuth(true)}>สร้างบัญชี</Button>
          <Button type="primary" icon={<LoginOutlined />} onClick={() => openAuth()}>เข้าสู่ระบบ</Button>
        </div>}
      </div>
      {account ? <div className="external-workspace__source">
        <Segmented aria-label="เลือกที่เก็บข้อมูล" value={mode} onChange={value => { setMode(value as 'local' | 'cloud'); refreshLocal(); }} options={[
          { label: 'บัญชีของฉัน', value: 'cloud', icon: <CloudOutlined /> },
          { label: 'ในเครื่องนี้', value: 'local', icon: <LaptopOutlined /> },
        ]} />
        <span>{mode === 'cloud' ? 'บันทึกในบัญชี • ดูต่อได้ทุกอุปกรณ์' : 'บันทึกเฉพาะเบราว์เซอร์นี้'}</span>
      </div> : <div className="external-workspace__benefit"><CloudOutlined /><span></span></div>}
    </section>
    {localError && <Alert type="warning" message={localError} className="external-account-alert" />}
    {account && localTimers.length > 0 && !imported && <section className="external-import-prompt">
      <span className="external-import-prompt__icon" aria-hidden><ImportOutlined /></span>
      <div><strong>มี {localTimers.length} รายการในเครื่องนี้</strong><p>ย้ายไปใช้ในบัญชีได้ โดยชื่อ สูตร และเวลาเดิมยังอยู่ครบ</p></div>
      <Button onClick={previewImport}>ตรวจรายการและนำเข้า</Button>
    </section>}
    {notice && <Alert type="success" showIcon message={notice} closable onClose={() => setNotice('')} className="external-account-alert" />}
    <FloorTimerDashboard key={`${mode}:${account?.id ?? 'local'}:${revision}`} external accountId={account?.id} cloud={mode === 'cloud' && !!account} />
    <Modal open={authOpen} onCancel={() => { if (!busy) setAuthOpen(false); }} footer={null} width={420} className="external-auth-modal" title={null} destroyOnClose maskClosable={!busy} closable={!busy}>
      <div className="external-auth-heading"><span aria-hidden><CloudOutlined /></span><h2>{register ? 'พื้นที่ของคุณ บนทุกอุปกรณ์' : 'กลับมาดูเครื่องนอกของคุณ'}</h2><p>{register ? 'สร้างบัญชี แล้วนำเข้ารายการเดิมได้เลย' : 'เข้าสู่ระบบครั้งเดียว ใช้งานต่อได้ยาว ๆ'}</p></div>
      <Segmented block value={register ? 'register' : 'login'} disabled={busy} onChange={value => { setRegister(value === 'register'); setAuthError(''); form.resetFields(); }} options={[{ label: 'เข้าสู่ระบบ', value: 'login' }, { label: 'สร้างบัญชี', value: 'register' }]} />
      {authError && <Alert type="error" showIcon message={authError} className="external-auth-error" />}
      <Form form={form} layout="vertical" preserve={false} onFinish={authenticate} requiredMark={false} className="external-auth-form" disabled={busy}>
        <Form.Item label="ชื่อผู้ใช้" name="username" rules={[{ required: true, message: 'กรอกชื่อผู้ใช้' }, { pattern: /^[a-zA-Z0-9_.-]{3,32}$/, message: 'ใช้ a-z, 0-9, จุด ขีดกลาง หรือขีดล่าง 3–32 ตัว' }]} extra={register ? '3–32 ตัว ใช้ตัวอักษรอังกฤษ ตัวเลข . - _' : undefined}><Input size="large" autoComplete="username" placeholder="เช่น sunlee" maxLength={32} autoCapitalize="none" spellCheck={false} /></Form.Item>
        <Form.Item label="รหัสผ่าน" name="password" rules={[{ required: true, message: 'กรอกรหัสผ่าน' }, { max: 128, message: 'รหัสผ่านไม่เกิน 128 ตัวอักษร' }]}><Input.Password size="large" placeholder="กรอกรหัสผ่าน" autoComplete={register ? 'new-password' : 'current-password'} /></Form.Item>
        {register && <Form.Item label="ยืนยันรหัสผ่าน" name="confirm" dependencies={['password']} rules={[{ required: true, message: 'ยืนยันรหัสผ่านอีกครั้ง' }, ({ getFieldValue }) => ({ validator: (_, value) => value === getFieldValue('password') ? Promise.resolve() : Promise.reject(new Error('รหัสผ่านไม่ตรงกัน')) })]}><Input.Password size="large" placeholder="กรอกรหัสผ่านเดิมอีกครั้ง" autoComplete="new-password" /></Form.Item>}
        <div className="external-auth-remember"><SafetyCertificateOutlined /><span>จำการเข้าสู่ระบบให้อัตโนมัติ 90 วัน<br /><small>ต่ออายุเมื่อกลับมาใช้งาน ไม่ต้องกรอกรหัสผ่านทุกครั้ง</small></span></div>
        <Button htmlType="submit" type="primary" block loading={busy} className="external-auth-submit">{register ? 'สร้างบัญชีและเริ่มใช้งาน' : 'เข้าสู่ระบบ'}</Button>
      </Form>
      {register && <p className="external-auth-note">รุ่นทดลองยังไม่มีระบบกู้รหัสผ่าน โปรดจำชื่อผู้ใช้และรหัสผ่านของคุณ</p>}
    </Modal>
    <Modal open={importRows !== null} title="นำรายการเดิมไปใช้ในบัญชี" width={460} onCancel={() => { if (!busy) setImportRows(null); }} onOk={() => void importLocal()} okText={`นำเข้า ${importRows?.length ?? 0} รายการ`} cancelText="ไว้ก่อน" confirmLoading={busy} okButtonProps={{ disabled: !importRows?.length }} cancelButtonProps={{ disabled: busy }} maskClosable={!busy} closable={!busy}>
      <p className="external-import-destination">จากเครื่องนี้ <span aria-hidden>→</span> บัญชี <strong>{account?.username}</strong></p>
      <ul className="external-import-list">{importRows?.map(row => <li key={row.floor_number}><strong>{row.name}</strong><span>{row.character_name || 'ยังไม่ระบุชื่อตัวละคร'}</span></li>)}</ul>
      {!importRows?.length && <p>ไม่มีรายการในเบราว์เซอร์นี้ ให้เปิดหน้านี้จากเครื่องที่เคยบันทึกข้อมูลไว้</p>}
      <p className="external-import-note"><CheckCircleFilled /> ชื่อ สูตร และเวลาเริ่มเดิมอยู่ครบ<br /><CheckCircleFilled /> ไม่ลบข้อมูลในเครื่อง และไม่เพิ่มซ้ำหรือทับข้อมูลบัญชี</p>
    </Modal>
  </>;
}

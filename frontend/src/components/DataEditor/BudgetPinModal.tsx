import { useState } from 'react';
import { Alert, Input, Modal } from 'antd';
import { verifyBudgetPin } from '../../api/client';

export function BudgetPinModal({ onVerified, onCancel }: {
  onVerified: (pin: string) => void; onCancel: () => void;
}) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const verify = async () => {
    if (busy || pin.length !== 4) return;
    setBusy(true); setError('');
    try { await verifyBudgetPin(pin); onVerified(pin); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  return <Modal open title="ใส่ PIN เพื่อแก้ไขงบประมาณ" okText="ยืนยัน" cancelText="ยกเลิก"
    onOk={() => void verify()} onCancel={onCancel} confirmLoading={busy} okButtonProps={{ disabled: pin.length !== 4 }}>
    <p>ใช้ PIN เดียวกับหน้าจัดการงบประมาณ</p>
    <Input.Password aria-label="PIN งบประมาณ" autoFocus inputMode="numeric" maxLength={4}
      value={pin} onChange={e => { setPin(e.target.value.replace(/\D/g, '')); setError(''); }}
      onPressEnter={() => void verify()} autoComplete="off" />
    {error && <Alert style={{ marginTop: 12 }} type="error" message={error} />}
  </Modal>;
}

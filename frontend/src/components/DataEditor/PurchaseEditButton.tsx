import { useState } from 'react';
import { Alert, Button, Form, Input, InputNumber, Modal, Select, Typography } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import type { StockPurchase } from '../../types';
import { editStockPurchase } from '../../api/client';
import { BudgetPinModal } from './BudgetPinModal';
import { itemSelectVisuals } from '../shared/ItemVisual';

function localDate(value: string) {
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
}

export function PurchaseEditButton({ purchase, itemNames, onSaved }: {
  purchase: StockPurchase; itemNames: Record<string, string>; onSaved: (purchase: StockPurchase) => void;
}) {
  const [askingPin, setAskingPin] = useState(false);
  const [pin, setPin] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [original, setOriginal] = useState(purchase);
  const [form] = Form.useForm();
  const quantity = Form.useWatch('quantity', form);
  const amount = Form.useWatch('total_amount', form);
  const currency = Form.useWatch('currency', form);
  const save = async () => {
    if (!pin || busy) return;
    try {
      const values = await form.validateFields();
      setBusy(true); setError('');
      const result = await editStockPurchase(original, {
        ...values, purchased_at: values.purchased_at === localDate(original.purchased_at)
          ? original.purchased_at : new Date(values.purchased_at).toISOString(),
      }, pin);
      setPin(null); onSaved(result);
    } catch (e) {
      if (e instanceof Error) setError(e.message);
    } finally { setBusy(false); }
  };
  return <>
    <Button size="small" icon={<EditOutlined />} onClick={() => { setOriginal(purchase); setAskingPin(true); }}>แก้ไข</Button>
    {askingPin && <BudgetPinModal onCancel={() => setAskingPin(false)} onVerified={value => {
      setAskingPin(false); setError('');
      form.setFieldsValue({ ...original, purchased_at: localDate(original.purchased_at) }); setPin(value);
    }} />}
    <Modal open={pin !== null} title="แก้ไขรายการซื้อ" okText="บันทึกการแก้ไข" cancelText="ยกเลิก"
      confirmLoading={busy} onOk={() => void save()} onCancel={() => { if (!busy) setPin(null); }} forceRender>
      <Form form={form} layout="vertical">
        <Form.Item name="item_id" label="รายการ" rules={[{ required: true, message: 'เลือกสินค้า' }]}>
          <Select {...itemSelectVisuals} showSearch optionFilterProp="label" options={Object.entries(itemNames)
            .filter(([, label]) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(label))
            .map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, 'th'))} />
        </Form.Item>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Form.Item name="quantity" label="จำนวนที่เพิ่มสต็อก" rules={[{ required: true }, { type: 'integer', min: 1, max: 2147483647 }]}>
            <InputNumber min={1} precision={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="total_amount" label="จ่ายทั้งหมด" rules={[{ required: true }, { type: 'number', min: 0 }]}>
            <InputNumber min={0} precision={2} style={{ width: '100%' }} />
          </Form.Item>
        </div>
        <Form.Item name="currency" label="สกุลเงิน" rules={[{ required: true }]}>
          <Select options={[{ value: 'THB', label: 'บาท (THB)' }, { value: 'G', label: 'เหรียญเกม (G)' }]} />
        </Form.Item>
        <Typography.Text type="secondary">ต้นทุน/ชิ้น: {quantity > 0 ? (amount / quantity).toLocaleString('th-TH', { maximumFractionDigits: 3 }) : '—'} {currency}</Typography.Text>
        <Form.Item name="contributor" label="งบจาก"><Input maxLength={200} /></Form.Item>
        <Form.Item name="source" label="แหล่งซื้อ"><Input maxLength={500} /></Form.Item>
        <Form.Item name="purchased_at" label="วันและเวลาที่ซื้อ" rules={[{ required: true }]}>
          <Input type="datetime-local" step="1" />
        </Form.Item>
      </Form>
      <Alert type="info" showIcon message="แก้จำนวนซื้อแล้ว สต็อกจะปรับเฉพาะส่วนต่าง หากสต็อกเดิมไม่พอ ระบบจะไม่บันทึก" />
      {error && <Alert style={{ marginTop: 12 }} type="error" showIcon message={error} />}
    </Modal>
  </>;
}

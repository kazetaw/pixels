import { useState } from 'react';
import {
  Table, Button, Input, Select, Modal, Form, InputNumber,
  Space, Tag, Avatar, Typography, Tooltip, message,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { Machine, Recipe, StockMap } from '../../types';
import { createMachine, updateMachine, deleteMachine } from '../../api/client';
import { ImagePicker } from '../shared/ImagePicker';

const { Text } = Typography;

// Valid occupation values
type Occupation = 'วิศวะกร' | 'หมอ' | 'เชฟ' | 'ไอดอล' | 'เกษตร' | 'ทุกอาชีพ';

const OCCUPATIONS: Occupation[] = ['วิศวะกร', 'หมอ', 'เชฟ', 'ไอดอล', 'เกษตร', 'ทุกอาชีพ'];

const OCCUPATION_IMAGE: Record<Occupation, string> = {
  วิศวะกร: '/occupations/engineer.png',
  หมอ:      '/occupations/doctor.png',
  เชฟ:      '/occupations/chef.png',
  ไอดอล:   '/occupations/idol.png',
  เกษตร:   '/occupations/farmer.png',
  ทุกอาชีพ: '/occupations/all.png',
};

const OCCUPATION_COLOR: Record<Occupation, string> = {
  วิศวะกร: 'blue',
  หมอ:      'green',
  เชฟ:      'orange',
  ไอดอล:   'pink',
  เกษตร:   'lime',
  ทุกอาชีพ: 'purple',
};

function OccupationBadge({ occ }: { occ: Occupation }) {
  return (
    <Tag color={OCCUPATION_COLOR[occ]} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <Avatar
        src={OCCUPATION_IMAGE[occ]}
        size={16}
        style={{ flexShrink: 0 }}
      />
      {occ}
    </Tag>
  );
}

interface MachineEditorProps {
  machines: Machine[];
  recipes: Recipe[];
  stocks: StockMap;
  onChange: () => void;
}

// ── Form modal ────────────────────────────────────────────────────────────────
interface MachineFormProps {
  open: boolean;
  initial?: Machine | null;
  machines: Machine[];
  recipes: Recipe[];
  stocks: StockMap;
  onSave: (data: Omit<Machine, 'machine_id'>) => Promise<void>;
  onCancel: () => void;
}

function MachineFormModal({ open, initial, machines, recipes, stocks, onSave, onCancel }: MachineFormProps) {
  const [form] = Form.useForm();
  const [imageUrl, setImageUrl] = useState<string | undefined>(initial?.image);
  const [saving, setSaving] = useState(false);
  const [editingId] = useState(initial?.machine_id);

  // sync preview when editing different item
  const handleAfterOpen = () => {
    setImageUrl(initial?.image);
    form.setFieldsValue({
      machine_name: initial?.machine_name ?? '',
      floor_number: initial?.floor_number ?? 1,
      occupation:   initial?.occupation  ?? undefined,
    });
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const normalizedName = values.machine_name.trim().normalize('NFKC').toLocaleLowerCase('th');
      const recipeIds = new Set(recipes.map((recipe) => recipe.id));
      const conflict = [
        ...machines.filter((machine) => machine.machine_id !== initial?.machine_id).map((machine) => machine.machine_name),
        ...recipes.map((recipe) => recipe.name),
        ...Object.keys(stocks).filter((key) => !recipeIds.has(key)),
      ].find((otherName) => otherName.trim().normalize('NFKC').toLocaleLowerCase('th') === normalizedName);
      if (conflict) {
        form.setFields([{ name: 'machine_name', errors: [`ชื่อนี้ซ้ำกับ "${conflict}" กรุณาใช้ชื่ออื่น`] }]);
        return;
      }
      setSaving(true);
      await onSave({
        machine_name:    values.machine_name.trim(),
        floor_number:    Number(values.floor_number),
        max_hours_limit: 0,
        ...(values.occupation && { occupation: values.occupation }),
        ...(imageUrl           && { image: imageUrl }),
      });
      form.resetFields();
      setImageUrl(undefined);
    } catch {
      // validation error — antd handles display
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={initial ? 'แก้ไขเครื่องจักร' : 'เพิ่มเครื่องจักรใหม่'}
      onCancel={onCancel}
      onOk={handleSave}
      okText={saving ? 'กำลังบันทึก…' : 'บันทึก'}
      cancelText="ยกเลิก"
      confirmLoading={saving}
      afterOpenChange={(v) => v && handleAfterOpen()}
      destroyOnClose
    >
      <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
        <Form.Item
          name="machine_name"
          label="ชื่อเครื่องจักร"
          rules={[{ required: true, message: 'กรุณากรอกชื่อเครื่องจักร' }]}
        >
          <Input placeholder="เช่น เครื่องช็อค" autoFocus />
        </Form.Item>

        <Form.Item
          name="floor_number"
          label="ชั้นที่"
          rules={[{ required: true, message: 'กรุณากรอกชั้นที่' }, { type: 'number', min: 1, message: 'ชั้นต้องมากกว่า 0' }]}
        >
          <InputNumber min={1} max={99} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item name="occupation" label="อาชีพ">
          <Select placeholder="เลือกอาชีพ (ไม่บังคับ)" allowClear>
            {OCCUPATIONS.map((occ) => (
              <Select.Option key={occ} value={occ}>
                <Space size={4}>
                  <Avatar src={OCCUPATION_IMAGE[occ]} size={16} />
                  {occ}
                </Space>
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        {/* รูปภาพ — อัปโหลดผ่าน Supabase Storage */}
        <Form.Item label="รูปภาพ">
          <ImagePicker
            value={imageUrl}
            onChange={setImageUrl}
            folder="machines"
            itemId={editingId}
            size={64}
            variant="button"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}

// ── Main MachineEditor ────────────────────────────────────────────────────────
export function MachineEditor({ machines, recipes, stocks, onChange }: MachineEditorProps) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState<Machine | null>(null);
  const [search, setSearch]     = useState('');
  const [filterOcc, setFilterOcc] = useState<string>('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [messageApi, contextHolder] = message.useMessage();

  const filtered = machines
    .filter((m) => {
      const matchSearch =
        m.machine_name.toLowerCase().includes(search.toLowerCase()) ||
        String(m.floor_number).includes(search);
      const matchOcc = filterOcc === '' || m.occupation === filterOcc;
      return matchSearch && matchOcc;
    })
    .sort((a, b) => a.machine_name.localeCompare(b.machine_name, 'th'));

  const handleCreate = async (data: Omit<Machine, 'machine_id'>) => {
    await createMachine(data);
    setShowForm(false);
    onChange();
    messageApi.success('เพิ่มเครื่องจักรสำเร็จ');
  };

  const handleUpdate = async (data: Omit<Machine, 'machine_id'>) => {
    if (!editing) return;
    await updateMachine(editing.machine_id, data);
    setEditing(null);
    onChange();
    messageApi.success('แก้ไขเครื่องจักรสำเร็จ');
  };

  const handleDelete = (id: string, name: string) => {
    Modal.confirm({
      title: 'ยืนยันการลบ',
      content: `ต้องการลบ "${name}" ใช่ไหม?`,
      okText: 'ลบ',
      okType: 'danger',
      cancelText: 'ยกเลิก',
      onOk: async () => {
        setDeleting(id);
        try {
          await deleteMachine(id);
          onChange();
          messageApi.success('ลบเครื่องจักรสำเร็จ');
        } finally {
          setDeleting(null);
        }
      },
    });
  };

  const columns: ColumnsType<Machine> = [
    {
      title: 'รูป',
      dataIndex: 'image',
      width: 80,
      align: 'center',
      render: (img, record) =>
        img ? (
          <img src={img} alt={record.machine_name} style={{ width: 56, height: 56, borderRadius: 6, objectFit: 'cover' }} />
        ) : (
          <div style={{ width: 56, height: 56, borderRadius: 6, background: '#f0f0f0', margin: '0 auto' }} />
        ),
    },
    {
      title: 'ชั้น',
      dataIndex: 'floor_number',
      width: 64,
      align: 'center',
      render: (n) => (
        <Avatar size={28} style={{ background: '#f0f0f0', color: '#555', fontSize: 12, fontWeight: 600 }}>
          {n}
        </Avatar>
      ),
    },
    {
      title: 'ชื่อเครื่องจักร',
      dataIndex: 'machine_name',
      render: (name) => <Text strong>{name}</Text>,
    },
    {
      title: 'อาชีพ',
      dataIndex: 'occupation',
      width: 140,
      align: 'center',
      render: (occ) =>
        occ ? <OccupationBadge occ={occ as Occupation} /> : <Text type="secondary">—</Text>,
    },
    {
      title: 'เวลาสูงสุด (จาก recipe)',
      dataIndex: 'max_hours_limit',
      width: 160,
      align: 'right',
      render: (v) =>
        v > 0 ? (
          <Text style={{ fontSize: 12 }}>{v.toFixed(2)} ชม.</Text>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: 'จัดการ',
      width: 100,
      align: 'center',
      render: (_, record) => (
        <Space>
          <Tooltip title="แก้ไข">
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => setEditing(record)}
            />
          </Tooltip>
          <Tooltip title="ลบ">
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              loading={deleting === record.machine_id}
              onClick={() => handleDelete(record.machine_id, record.machine_name)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {contextHolder}

      {/* Toolbar */}
      <Space wrap>
        <Input
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ค้นหาชื่อหรือชั้น…"
          style={{ width: 200 }}
          allowClear
        />
        <Select
          value={filterOcc || undefined}
          onChange={(v) => setFilterOcc(v ?? '')}
          placeholder="ทุกอาชีพ"
          allowClear
          style={{ width: 140 }}
        >
          {OCCUPATIONS.map((o) => (
            <Select.Option key={o} value={o}>{o}</Select.Option>
          ))}
        </Select>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setShowForm(true)}
        >
          เพิ่มเครื่องจักร
        </Button>
      </Space>

      {/* Table */}
      <Table
        columns={columns}
        dataSource={filtered}
        rowKey="machine_id"
        size="small"
        pagination={false}
        scroll={{ y: 420 }}
        locale={{ emptyText: 'ไม่พบเครื่องจักร' }}
        footer={() => (
          <Text type="secondary" style={{ fontSize: 12 }}>
            รวม {machines.length} เครื่อง
          </Text>
        )}
      />

      <MachineFormModal
        open={showForm}
        machines={machines}
        recipes={recipes}
        stocks={stocks}
        onSave={handleCreate}
        onCancel={() => setShowForm(false)}
      />
      <MachineFormModal
        open={!!editing}
        initial={editing}
        machines={machines}
        recipes={recipes}
        stocks={stocks}
        onSave={handleUpdate}
        onCancel={() => setEditing(null)}
      />
    </div>
  );
}

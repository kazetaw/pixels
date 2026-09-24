import { ItemLabel } from '../shared/ItemVisual';
import { MachineWorkloadEntry } from '../../types';
import { Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';

interface Props {
  entries: MachineWorkloadEntry[];
}

export function MachineWorkloadTable({ entries }: Props) {
  if (entries.length === 0)
    return <p style={{ fontSize: 13, color: '#94a3b8', fontStyle: 'italic' }}>ไม่มีภาระงานเครื่องจักร</p>;

  const sorted = [...entries].sort((a, b) => b.hours_required - a.hours_required);

  const columns: ColumnsType<MachineWorkloadEntry> = [
    {
      title: '',
      width: 12,
      render: (_, row) => {
        const over = row.hours_required > row.max_hours_limit;
        return (
          <span style={{
            display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
            background: over ? '#ef4444' : '#22c55e',
          }} />
        );
      },
    },
    {
      title: 'ชื่อเครื่องจักร',
      dataIndex: 'machine_name',
      render: (name, row) => <ItemLabel id={row.machine_id} name={name} size={32} reserveImage />,
    },
    {
      title: 'ชั้น',
      dataIndex: 'floor_number',
      width: 60,
      align: 'center',
      render: (n) => <span style={{ fontSize: 12, color: '#64748b' }}>{n}</span>,
    },
    {
      title: 'ชั่วโมงที่ต้องใช้',
      dataIndex: 'hours_required',
      align: 'right',
      render: (v, row) => {
        const over = row.hours_required > row.max_hours_limit;
        return (
          <span style={{ fontSize: 13, fontWeight: 600, color: over ? '#dc2626' : '#0f172a' }}>
            {v.toFixed(2)}h
          </span>
        );
      },
    },
    {
      title: 'สูงสุด',
      dataIndex: 'max_hours_limit',
      align: 'right',
      render: (v) => <span style={{ fontSize: 13, color: '#64748b' }}>{v}h</span>,
    },
    {
      title: 'การใช้งาน',
      align: 'right',
      render: (_, row) => {
        const over = row.hours_required > row.max_hours_limit;
        const pct = row.max_hours_limit > 0
          ? Math.round((row.hours_required / row.max_hours_limit) * 100)
          : 0;
        return (
          <Tag color={over ? 'red' : pct >= 80 ? 'orange' : 'green'} style={{ fontWeight: 600 }}>
            {pct}%
          </Tag>
        );
      },
    },
  ];

  return (
    <Table<MachineWorkloadEntry>
      columns={columns}
      dataSource={sorted}
      rowKey="machine_id"
      pagination={false}
      size="small"
      rowClassName={(row) => row.hours_required > row.max_hours_limit ? 'bg-red-50' : ''}
    />
  );
}

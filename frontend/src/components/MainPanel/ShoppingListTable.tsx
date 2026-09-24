import { ItemThumbnail } from '../shared/ItemVisual';
import { ShoppingListEntry, StockImageMap, StockMap } from '../../types';
import { Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { WarningOutlined } from '@ant-design/icons';

interface Props {
  entries: ShoppingListEntry[];
  stocks: StockMap;
  stockImages: StockImageMap;
}

export function ShoppingListTable({ entries, stocks, stockImages }: Props) {
  if (entries.length === 0)
    return <p style={{ fontSize: 13, color: '#94a3b8', fontStyle: 'italic' }}>ไม่มีวัตถุดิบที่ต้องจัดหา</p>;

  const columns: ColumnsType<ShoppingListEntry> = [
    {
      title: '',
      dataIndex: 'item_id',
      width: 44,
      render: (id) => <ItemThumbnail id={id} image={stockImages[id]} size={36} />,
    },
    {
      title: 'ชื่อวัตถุดิบ',
      dataIndex: 'item_name',
      render: (name, row) => {
        const inStock = stocks[row.item_id] ?? 0;
        const isShort = row.net_required > inStock;
        return (
          <span style={{ fontSize: 13, fontWeight: 500, color: isShort ? '#b91c1c' : '#0f172a' }}>
            {isShort && <WarningOutlined style={{ marginRight: 5, color: '#ef4444', fontSize: 12 }} />}
            {name}
          </span>
        );
      },
    },
    {
      title: 'ต้องใช้ทั้งหมด',
      dataIndex: 'total_needed',
      align: 'right',
      render: (v) => <span style={{ fontSize: 13, color: '#374151' }}>{v.toLocaleString()}</span>,
    },
    {
      title: 'ต้องจัดหาเพิ่ม',
      dataIndex: 'net_required',
      align: 'right',
      render: (v, row) => {
        const inStock = stocks[row.item_id] ?? 0;
        const isShort = row.net_required > inStock;
        return (
          <span style={{ fontSize: 13, fontWeight: 600, color: isShort ? '#dc2626' : '#0f172a' }}>
            {v.toLocaleString()}
          </span>
        );
      },
    },
    {
      title: 'มีในสต็อก',
      dataIndex: 'item_id',
      align: 'right',
      render: (id) => <span style={{ fontSize: 13, color: '#64748b' }}>{(stocks[id] ?? 0).toLocaleString()}</span>,
    },
  ];

  return (
    <Table<ShoppingListEntry>
      columns={columns}
      dataSource={entries}
      rowKey="item_id"
      pagination={false}
      size="small"
      rowClassName={(row) => {
        const inStock = stocks[row.item_id] ?? 0;
        return row.net_required > inStock ? 'bg-red-50' : '';
      }}
    />
  );
}

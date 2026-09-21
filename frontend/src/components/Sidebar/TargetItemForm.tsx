import { useState } from 'react';
import { Select, InputNumber, Button } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { Recipe, TargetItem } from '../../types';

interface TargetItemFormProps {
  recipes: Recipe[];
  onAdd: (item: TargetItem) => void;
}

export function TargetItemForm({ recipes, onAdd }: TargetItemFormProps) {
  const [selectedId, setSelectedId] = useState(recipes[0]?.id ?? '');
  const [quantity, setQuantity] = useState<number | null>(null);
  const [showError, setShowError] = useState(false);

  const handleAdd = () => {
    if (!quantity || quantity <= 0) { setShowError(true); return; }
    if (!selectedId) return;
    onAdd({ target_item_id: selectedId, target_quantity: quantity });
    setQuantity(null);
    setShowError(false);
  };

  const options = recipes.map((r) => ({ label: r.name, value: r.id }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <Select
        value={selectedId || undefined}
        onChange={setSelectedId}
        options={options}
        showSearch
        placeholder="เลือกสินค้า…"
        filterOption={(input, opt) =>
          (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
        }
        style={{ width: '100%' }}
        size="small"
      />

      <div style={{ display: 'flex', gap: 6 }}>
        <InputNumber
          min={1}
          value={quantity}
          onChange={(v) => { setShowError(false); setQuantity(v); }}
          onPressEnter={handleAdd}
          placeholder="จำนวน"
          style={{ flex: 1 }}
          size="small"
        />
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleAdd}
          disabled={!quantity || quantity <= 0}
          size="small"
        >
          เพิ่ม
        </Button>
      </div>
      {showError && (
        <p style={{ fontSize: 11, color: '#ef4444', margin: 0 }}>กรุณากรอกจำนวนมากกว่า 0</p>
      )}
    </div>
  );
}

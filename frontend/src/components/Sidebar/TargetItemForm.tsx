import { useState } from 'react';
import { Recipe, TargetItem } from '../../types';

interface TargetItemFormProps {
  recipes: Recipe[];
  onAdd: (item: TargetItem) => void;
}

export function TargetItemForm({ recipes, onAdd }: TargetItemFormProps) {
  const [selectedId, setSelectedId] = useState(recipes[0]?.id ?? '');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [showError, setShowError] = useState(false);

  const handleAdd = () => {
    if (!quantity || quantity <= 0) { setShowError(true); return; }
    if (!selectedId) return;
    onAdd({ target_item_id: selectedId, target_quantity: Number(quantity) });
    setQuantity('');
    setShowError(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <select
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
        style={{
          width: '100%', borderRadius: 6, border: '1px solid #e2e8f0',
          padding: '7px 10px', fontSize: 13, color: '#0f172a',
          background: '#ffffff', outline: 'none',
        }}
      >
        {recipes.map((r) => (
          <option key={r.id} value={r.id}>{r.name}</option>
        ))}
      </select>

      <div style={{ display: 'flex', gap: 6 }}>
        <input
          type="number" min={1} value={quantity}
          onChange={(e) => { setShowError(false); setQuantity(e.target.value === '' ? '' : Number(e.target.value)); }}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="จำนวน"
          style={{
            width: 80, borderRadius: 6, border: '1px solid #e2e8f0',
            padding: '7px 8px', fontSize: 13, textAlign: 'center', outline: 'none',
          }}
        />
        <button
          onClick={handleAdd}
          disabled={!quantity || Number(quantity) <= 0}
          style={{
            flex: 1, borderRadius: 6, background: '#2563eb', color: '#fff',
            border: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer',
            padding: '7px 12px', opacity: (!quantity || Number(quantity) <= 0) ? 0.45 : 1,
          }}
        >
          เพิ่ม
        </button>
      </div>
      {showError && <p style={{ fontSize: 11, color: '#ef4444', margin: 0 }}>กรุณากรอกจำนวนมากกว่า 0</p>}
    </div>
  );
}

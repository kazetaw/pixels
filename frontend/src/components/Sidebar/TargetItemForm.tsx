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
    if (!quantity || quantity <= 0) {
      setShowError(true);
      return;
    }
    if (!selectedId) return;

    onAdd({ target_item_id: selectedId, target_quantity: Number(quantity) });
    setQuantity('');
    setShowError(false);
  };

  const handleQuantityChange = (val: string) => {
    setShowError(false);
    setQuantity(val === '' ? '' : Number(val));
  };

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">เพิ่มไอเทมเป้าหมาย</h3>

      {/* Recipe dropdown */}
      <select
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        {recipes.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>

      {/* Quantity input */}
      <div className="flex gap-2">
        <input
          type="number"
          min={1}
          value={quantity}
          onChange={(e) => handleQuantityChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="จำนวน"
          className="w-24 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          onClick={handleAdd}
          disabled={!quantity || Number(quantity) <= 0}
          className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          เพิ่ม
        </button>
      </div>

      {/* Validation message */}
      {showError && (
        <p className="text-xs text-red-600">กรุณากรอกจำนวนมากกว่า 0</p>
      )}
    </div>
  );
}

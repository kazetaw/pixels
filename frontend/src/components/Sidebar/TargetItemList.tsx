import { ItemLabel } from '../shared/ItemVisual';
import { Recipe, TargetItem } from '../../types';

interface TargetItemListProps {
  items: TargetItem[];
  recipes: Recipe[];
  onRemove: (index: number) => void;
}

export function TargetItemList({ items, recipes, onRemove }: TargetItemListProps) {
  const recipeMap = new Map(recipes.map((r) => [r.id, r.name]));
  if (items.length === 0) return null;

  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
      {items.map((item, index) => (
        <li
          key={`${item.target_item_id}-${index}`}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: '#eff6ff', borderRadius: 6, padding: '6px 10px',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 500, color: '#1e40af', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <ItemLabel id={item.target_item_id} name={recipeMap.get(item.target_item_id) ?? item.target_item_id} size={24} />
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <span style={{ fontSize: 12, color: '#3b82f6', fontWeight: 500 }}>×{item.target_quantity}</span>
            <button
              onClick={() => onRemove(index)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 14, lineHeight: 1, padding: 0 }}
              aria-label="ลบ"
            >
              ✕
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

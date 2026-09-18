import { Recipe, TargetItem } from '../../types';

interface TargetItemListProps {
  items: TargetItem[];
  recipes: Recipe[];
  onRemove: (index: number) => void;
}

export function TargetItemList({ items, recipes, onRemove }: TargetItemListProps) {
  const recipeMap = new Map(recipes.map((r) => [r.id, r.name]));

  if (items.length === 0) {
    return (
      <p className="text-sm text-gray-400 italic">ยังไม่มีไอเทมเป้าหมาย</p>
    );
  }

  return (
    <ul className="space-y-1">
      {items.map((item, index) => (
        <li
          key={`${item.target_item_id}-${index}`}
          className="flex items-center justify-between rounded-md bg-blue-50 px-3 py-2 text-sm"
        >
          <span className="font-medium text-gray-800">
            {recipeMap.get(item.target_item_id) ?? item.target_item_id}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-gray-600">×{item.target_quantity}</span>
            <button
              onClick={() => onRemove(index)}
              className="text-red-500 hover:text-red-700 font-bold text-base leading-none"
              aria-label={`Remove ${recipeMap.get(item.target_item_id) ?? item.target_item_id}`}
            >
              ✕
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

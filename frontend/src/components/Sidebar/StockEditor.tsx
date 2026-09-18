import { Recipe, StockMap } from '../../types';

interface StockEditorProps {
  recipes: Recipe[];
  stocks: StockMap;
  onUpdate: (itemId: string, qty: number) => void;
}

// Collect all unique items (recipe outputs + all ingredients)
function getAllItems(recipes: Recipe[]): Array<{ id: string; name: string }> {
  const itemMap = new Map<string, string>();
  for (const recipe of recipes) {
    itemMap.set(recipe.id, recipe.name);
    for (const ingredientId of Object.keys(recipe.ingredients)) {
      if (!itemMap.has(ingredientId)) {
        // Convert snake_case to Title Case for raw materials
        const name = ingredientId
          .split('_')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');
        itemMap.set(ingredientId, name);
      }
    }
  }
  return Array.from(itemMap.entries()).map(([id, name]) => ({ id, name }));
}

export function StockEditor({ recipes, stocks, onUpdate }: StockEditorProps) {
  const items = getAllItems(recipes);

  return (
    <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
      {items.map(({ id, name }) => (
        <div key={id} className="flex items-center gap-2">
          <label className="flex-1 text-sm text-gray-700 truncate" title={name}>
            {name}
          </label>
          <input
            type="number"
            min={0}
            value={stocks[id] ?? 0}
            onChange={(e) => onUpdate(id, Number(e.target.value))}
            className="w-24 rounded border border-gray-300 px-2 py-1 text-sm text-right focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      ))}
    </div>
  );
}

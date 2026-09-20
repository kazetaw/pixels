import { Recipe, StockImageMap, StockMap } from '../../types';

interface StockEditorProps {
  recipes: Recipe[];
  stocks: StockMap;
  stockImages: StockImageMap;
  onUpdate: (itemId: string, qty: number) => void;
}

// Collect all unique items (recipe outputs + all ingredients)
function getAllItems(recipes: Recipe[], stocks: StockMap): Array<{ id: string; name: string }> {
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
  // Include raw materials that were added directly in the stock manager,
  // even before a recipe starts using them.
  for (const itemId of Object.keys(stocks)) {
    if (!itemMap.has(itemId)) itemMap.set(itemId, itemId);
  }
  return Array.from(itemMap.entries()).map(([id, name]) => ({ id, name }));
}

export function StockEditor({ recipes, stocks, stockImages, onUpdate }: StockEditorProps) {
  const items = getAllItems(recipes, stocks);

  return (
    <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
      {items.map(({ id, name }) => (
        <div key={id} className="flex items-center gap-2">
          {stockImages[id] ? (
            <img
              src={stockImages[id]}
              alt=""
              className="h-7 w-7 rounded object-contain bg-white/10 flex-shrink-0"
            />
          ) : (
            <div className="h-7 w-7 rounded bg-white/10 flex-shrink-0" />
          )}
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

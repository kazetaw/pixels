import { Recipe, StockImageMap, StockMap } from '../../types';

interface StockEditorProps {
  recipes: Recipe[];
  stocks: StockMap;
  stockImages: StockImageMap;
  onUpdate: (itemId: string, qty: number) => void;
}

function getAllItems(recipes: Recipe[], stocks: StockMap): Array<{ id: string; name: string }> {
  const itemMap = new Map<string, string>();
  for (const recipe of recipes) {
    itemMap.set(recipe.id, recipe.name);
    for (const ingredientId of Object.keys(recipe.ingredients)) {
      if (!itemMap.has(ingredientId)) itemMap.set(ingredientId, ingredientId);
    }
  }
  for (const itemId of Object.keys(stocks)) {
    if (!itemMap.has(itemId)) itemMap.set(itemId, itemId);
  }
  return Array.from(itemMap.entries()).map(([id, name]) => ({ id, name }));
}

export function StockEditor({ recipes, stocks, stockImages, onUpdate }: StockEditorProps) {
  const items = getAllItems(recipes, stocks);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 260, overflowY: 'auto', paddingRight: 2 }}>
      {items.map(({ id, name }) => (
        <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          {stockImages[id] ? (
            <img src={stockImages[id]} alt="" style={{ width: 26, height: 26, borderRadius: 4, objectFit: 'contain', background: '#f1f5f9', flexShrink: 0 }} />
          ) : (
            <div style={{ width: 26, height: 26, borderRadius: 4, background: '#f1f5f9', flexShrink: 0 }} />
          )}
          <span style={{ flex: 1, fontSize: 12, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={name}>
            {name}
          </span>
          <input
            type="number" min={0} value={stocks[id] ?? 0}
            onChange={(e) => onUpdate(id, Number(e.target.value))}
            style={{
              width: 60, borderRadius: 4, border: '1px solid #e2e8f0',
              padding: '4px 6px', fontSize: 12, textAlign: 'right',
              color: '#0f172a', outline: 'none',
            }}
          />
        </div>
      ))}
    </div>
  );
}

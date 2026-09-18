import { useState, useCallback } from 'react';
import { Recipe, Machine, StockMap } from '../../types';
import { fetchAllData } from '../../api/client';
import { RecipeEditor } from './RecipeEditor';
import { StockEditorFull } from './StockEditorFull';

interface DataEditorProps {
  initialRecipes: Recipe[];
  initialMachines: Machine[];
  initialStocks: StockMap;
}

type DataTab = 'recipes' | 'stocks';

export function DataEditor({ initialRecipes, initialMachines, initialStocks }: DataEditorProps) {
  const [tab, setTab] = useState<DataTab>('recipes');
  const [recipes, setRecipes] = useState<Recipe[]>(initialRecipes);
  const [machines] = useState<Machine[]>(initialMachines);
  const [stocks, setStocks] = useState<StockMap>(initialStocks);
  const [reloading, setReloading] = useState(false);

  // reload recipes from backend after any mutation
  const reloadRecipes = useCallback(async () => {
    setReloading(true);
    try {
      const data = await fetchAllData();
      setRecipes(data.recipes);
    } finally {
      setReloading(false);
    }
  }, []);

  const tabs: { key: DataTab; label: string }[] = [
    { key: 'recipes', label: '📋 สูตรการผลิต' },
    { key: 'stocks',  label: '📦 สต็อกวัตถุดิบ' },
  ];

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-1 border-b border-gray-200 pb-0">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors ${
              tab === key
                ? 'bg-white border border-b-white border-gray-200 text-indigo-700 font-semibold -mb-px'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        ))}
        {reloading && <span className="ml-2 text-xs text-gray-400 self-center animate-pulse">กำลังโหลด…</span>}
      </div>

      {/* Content */}
      {tab === 'recipes' && (
        <RecipeEditor
          recipes={recipes}
          machines={machines}
          stocks={stocks}
          onChange={reloadRecipes}
        />
      )}

      {tab === 'stocks' && (
        <StockEditorFull
          stocks={stocks}
          recipes={recipes}
          onSaved={(newStocks) => setStocks(newStocks)}
        />
      )}
    </div>
  );
}

import { useState, useCallback, useEffect } from 'react';
import { Recipe, Machine, StockMap, StockImageMap } from '../../types';
import { fetchAllData } from '../../api/client';
import { RecipeEditor } from './RecipeEditor';
import { StockEditorFull } from './StockEditorFull';
import { MachineEditor } from './MachineEditor';

interface DataEditorProps {
  initialRecipes: Recipe[];
  initialMachines: Machine[];
  initialStocks: StockMap;
  initialStockImages: StockImageMap;
}

type DataTab = 'recipes' | 'machines' | 'stocks';

export function DataEditor({ initialRecipes, initialMachines, initialStocks, initialStockImages }: DataEditorProps) {
  const [tab, setTab] = useState<DataTab>('recipes');
  const [recipes, setRecipes] = useState<Recipe[]>(initialRecipes);
  const [machines, setMachines] = useState<Machine[]>(initialMachines);
  const [stocks, setStocks] = useState<StockMap>(initialStocks);
  const [stockImages, setStockImages] = useState<StockImageMap>(initialStockImages);
  const [reloading, setReloading] = useState(false);

  // App data can arrive after this editor first mounts when Backend starts later.
  useEffect(() => {
    setRecipes(initialRecipes);
    setMachines(initialMachines);
    setStocks(initialStocks);
    setStockImages(initialStockImages);
  }, [initialRecipes, initialMachines, initialStocks, initialStockImages]);

  const reload = useCallback(async () => {
    setReloading(true);
    try {
      const data = await fetchAllData();
      setRecipes(data.recipes);
      setMachines(data.machines);
      setStocks(data.stocks);
      setStockImages(data.stockImages ?? {});
    } finally {
      setReloading(false);
    }
  }, []);

  const tabs: { key: DataTab; label: string }[] = [
    { key: 'recipes',  label: 'สูตรการผลิต' },
    { key: 'machines', label: 'เครื่องจักร' },
    { key: 'stocks',   label: 'สต็อกวัตถุดิบ' },
  ];

  return (
    <div>
      {/* Sub-tabs */}
      <nav className="tab-nav">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={tab === key ? 'active' : ''}
          >
            {label}
            {reloading && tab === key && (
              <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 6 }}>โหลด…</span>
            )}
          </button>
        ))}
      </nav>

      {/* Content */}
      {tab === 'recipes' && (
        <RecipeEditor
          recipes={recipes}
          machines={machines}
          stocks={stocks}
          onChange={reload}
        />
      )}

      {tab === 'machines' && (
        <MachineEditor
          machines={machines}
          recipes={recipes}
          stocks={stocks}
          onChange={reload}
        />
      )}

      {tab === 'stocks' && (
        <StockEditorFull
          stocks={stocks}
          stockImages={stockImages}
          recipes={recipes}
          machines={machines}
          onSaved={(newStocks, newImages) => { setStocks(newStocks); setStockImages(newImages); }}
        />
      )}
    </div>
  );
}

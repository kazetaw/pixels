import { useState, useEffect, useCallback } from 'react';
import { fetchAllData, saveStocks as apiSaveStocks, runCalculation } from '../api/client';
import {
  Recipe,
  Machine,
  StockMap,
  StockImageMap,
  TargetItem,
  CalculateResponse,
} from '../types';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface AppState {
  // Reference data
  recipes: Recipe[];
  machines: Machine[];
  stocks: StockMap;
  stockImages: StockImageMap;

  // Target items list
  targetItems: TargetItem[];
  addTargetItem: (item: TargetItem) => void;
  removeTargetItem: (index: number) => void;

  // Stock editor
  updateStock: (itemId: string, qty: number) => void;
  saveStocks: () => Promise<void>;

  // Calculation
  runCalculation: () => Promise<void>;
  calculationResult: CalculateResponse | null;

  // UI states
  loading: boolean;
  initError: string | null;
  calcError: string | null;
  saveStatus: SaveStatus;
  saveError: string | null;
}

export function useAppState(): AppState {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [stocks, setStocks] = useState<StockMap>({});
  const [stockImages, setStockImages] = useState<StockImageMap>({});
  const [targetItems, setTargetItems] = useState<TargetItem[]>([]);
  const [calculationResult, setCalculationResult] = useState<CalculateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  // Load all data on mount
  useEffect(() => {
    fetchAllData()
      .then((data) => {
        setRecipes(data.recipes);
        setMachines(data.machines);
        setStocks(data.stocks);
        setStockImages(data.stockImages ?? {});
      })
      .catch((err: Error) => {
        setInitError(err.message ?? 'Failed to load application data');
      });
  }, []);

  const addTargetItem = useCallback((item: TargetItem) => {
    setTargetItems((prev) => [...prev, item]);
  }, []);

  const removeTargetItem = useCallback((index: number) => {
    setTargetItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateStock = useCallback((itemId: string, qty: number) => {
    setStocks((prev) => ({ ...prev, [itemId]: qty }));
  }, []);

  const saveStocks = useCallback(async () => {
    setSaveStatus('saving');
    setSaveError(null);
    try {
      await apiSaveStocks(stocks);
      setSaveStatus('saved');
      // Auto-reset to idle after 3 seconds
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err: unknown) {
      setSaveStatus('error');
      setSaveError((err as Error).message ?? 'Failed to save stocks');
    }
  }, [stocks]);

  const calculate = useCallback(async () => {
    setLoading(true);
    setCalcError(null);
    setCalculationResult(null);
    try {
      const result = await runCalculation(targetItems);
      setCalculationResult(result);
    } catch (err: unknown) {
      setCalcError((err as Error).message ?? 'Calculation failed');
    } finally {
      setLoading(false);
    }
  }, [targetItems]);

  return {
    recipes,
    machines,
    stocks,
    stockImages,
    targetItems,
    addTargetItem,
    removeTargetItem,
    updateStock,
    saveStocks,
    runCalculation: calculate,
    calculationResult,
    loading,
    initError,
    calcError,
    saveStatus,
    saveError,
  };
}

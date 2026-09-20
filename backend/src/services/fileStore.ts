import { promises as fs } from 'fs';
import path from 'path';
import { Recipe, Machine, StockMap, StockImageMap } from '../types';

// Data directory is at backend/data/ relative to this file's location (src/services/)
const DATA_DIR = path.resolve(__dirname, '../../data');

const RECIPES_PATH = path.join(DATA_DIR, 'recipes.json');
const MACHINES_PATH = path.join(DATA_DIR, 'machines.json');
const STOCKS_PATH = path.join(DATA_DIR, 'stocks.json');
const STOCK_IMAGES_PATH = path.join(DATA_DIR, 'stock_images.json');

/**
 * Read all recipes from recipes.json.
 * Throws if the file cannot be read or parsed.
 */
export async function readRecipes(): Promise<Recipe[]> {
  const raw = await fs.readFile(RECIPES_PATH, 'utf-8');
  return JSON.parse(raw) as Recipe[];
}

/**
 * Read all machines from machines.json.
 * Throws if the file cannot be read or parsed.
 */
export async function readMachines(): Promise<Machine[]> {
  const raw = await fs.readFile(MACHINES_PATH, 'utf-8');
  return JSON.parse(raw) as Machine[];
}

/**
 * Read stocks from stocks.json.
 * Returns an empty object {} if the file is missing or empty (Requirement 1.4).
 */
export async function readStocks(): Promise<StockMap> {
  try {
    const raw = await fs.readFile(STOCKS_PATH, 'utf-8');
    const trimmed = raw.trim();
    if (!trimmed) return {};
    return JSON.parse(trimmed) as StockMap;
  } catch (err: unknown) {
    // File not found — treat as empty stock
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw err;
  }
}

/**
 * Read stock images from stock_images.json.
 * Returns an empty object {} if the file is missing or empty.
 */
export async function readStockImages(): Promise<StockImageMap> {
  try {
    const raw = await fs.readFile(STOCK_IMAGES_PATH, 'utf-8');
    const trimmed = raw.trim();
    if (!trimmed) return {};
    return JSON.parse(trimmed) as StockImageMap;
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw err;
  }
}

/**
 * Overwrite stocks.json with the provided stock map.
 * Creates the file if it doesn't exist.
 */
export async function writeStocks(stocks: StockMap): Promise<void> {
  await fs.writeFile(STOCKS_PATH, JSON.stringify(stocks, null, 2), 'utf-8');
}

/**
 * Overwrite stock_images.json with the provided image map.
 */
export async function writeStockImages(images: StockImageMap): Promise<void> {
  await fs.writeFile(STOCK_IMAGES_PATH, JSON.stringify(images, null, 2), 'utf-8');
}

/**
 * Overwrite recipes.json with the provided array.
 */
export async function writeRecipes(recipes: Recipe[]): Promise<void> {
  await fs.writeFile(RECIPES_PATH, JSON.stringify(recipes, null, 2), 'utf-8');
}

/**
 * Overwrite machines.json with the provided array.
 */
export async function writeMachines(machines: Machine[]): Promise<void> {
  await fs.writeFile(MACHINES_PATH, JSON.stringify(machines, null, 2), 'utf-8');
}

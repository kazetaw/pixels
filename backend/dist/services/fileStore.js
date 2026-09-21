"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeMachines = exports.writeRecipes = exports.writeStockPurchases = exports.readStockPurchases = exports.writeBudgets = exports.readBudgets = exports.writeStockImages = exports.writeStocks = exports.readStockImages = exports.readStocks = exports.readMachines = exports.readRecipes = void 0;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
// Data directory is at backend/data/ relative to this file's location (src/services/)
const DATA_DIR = path_1.default.resolve(__dirname, '../../data');
const RECIPES_PATH = path_1.default.join(DATA_DIR, 'recipes.json');
const MACHINES_PATH = path_1.default.join(DATA_DIR, 'machines.json');
const STOCKS_PATH = path_1.default.join(DATA_DIR, 'stocks.json');
const STOCK_IMAGES_PATH = path_1.default.join(DATA_DIR, 'stock_images.json');
const BUDGETS_PATH = path_1.default.join(DATA_DIR, 'budgets.json');
const PURCHASES_PATH = path_1.default.join(DATA_DIR, 'stock_purchases.json');
/**
 * Read all recipes from recipes.json.
 * Throws if the file cannot be read or parsed.
 */
async function readRecipes() {
    const raw = await fs_1.promises.readFile(RECIPES_PATH, 'utf-8');
    return JSON.parse(raw);
}
exports.readRecipes = readRecipes;
/**
 * Read all machines from machines.json.
 * Throws if the file cannot be read or parsed.
 */
async function readMachines() {
    const raw = await fs_1.promises.readFile(MACHINES_PATH, 'utf-8');
    return JSON.parse(raw);
}
exports.readMachines = readMachines;
/**
 * Read stocks from stocks.json.
 * Returns an empty object {} if the file is missing or empty (Requirement 1.4).
 */
async function readStocks() {
    try {
        const raw = await fs_1.promises.readFile(STOCKS_PATH, 'utf-8');
        const trimmed = raw.trim();
        if (!trimmed)
            return {};
        return JSON.parse(trimmed);
    }
    catch (err) {
        // File not found — treat as empty stock
        if (err.code === 'ENOENT')
            return {};
        throw err;
    }
}
exports.readStocks = readStocks;
/**
 * Read stock images from stock_images.json.
 * Returns an empty object {} if the file is missing or empty.
 */
async function readStockImages() {
    try {
        const raw = await fs_1.promises.readFile(STOCK_IMAGES_PATH, 'utf-8');
        const trimmed = raw.trim();
        if (!trimmed)
            return {};
        return JSON.parse(trimmed);
    }
    catch (err) {
        if (err.code === 'ENOENT')
            return {};
        throw err;
    }
}
exports.readStockImages = readStockImages;
/**
 * Overwrite stocks.json with the provided stock map.
 * Creates the file if it doesn't exist.
 */
async function writeStocks(stocks) {
    await fs_1.promises.writeFile(STOCKS_PATH, JSON.stringify(stocks, null, 2), 'utf-8');
}
exports.writeStocks = writeStocks;
/**
 * Overwrite stock_images.json with the provided image map.
 */
async function writeStockImages(images) {
    await fs_1.promises.writeFile(STOCK_IMAGES_PATH, JSON.stringify(images, null, 2), 'utf-8');
}
exports.writeStockImages = writeStockImages;
async function readBudgets() {
    try {
        const raw = await fs_1.promises.readFile(BUDGETS_PATH, 'utf-8');
        return raw.trim() ? JSON.parse(raw) : [];
    }
    catch (err) {
        if (err.code === 'ENOENT')
            return [];
        throw err;
    }
}
exports.readBudgets = readBudgets;
async function writeBudgets(budgets) {
    await fs_1.promises.writeFile(BUDGETS_PATH, JSON.stringify(budgets, null, 2), 'utf-8');
}
exports.writeBudgets = writeBudgets;
async function readStockPurchases() {
    try {
        const raw = await fs_1.promises.readFile(PURCHASES_PATH, 'utf-8');
        return raw.trim() ? JSON.parse(raw) : [];
    }
    catch (err) {
        if (err.code === 'ENOENT')
            return [];
        throw err;
    }
}
exports.readStockPurchases = readStockPurchases;
async function writeStockPurchases(purchases) {
    await fs_1.promises.writeFile(PURCHASES_PATH, JSON.stringify(purchases, null, 2), 'utf-8');
}
exports.writeStockPurchases = writeStockPurchases;
/**
 * Overwrite recipes.json with the provided array.
 */
async function writeRecipes(recipes) {
    await fs_1.promises.writeFile(RECIPES_PATH, JSON.stringify(recipes, null, 2), 'utf-8');
}
exports.writeRecipes = writeRecipes;
/**
 * Overwrite machines.json with the provided array.
 */
async function writeMachines(machines) {
    await fs_1.promises.writeFile(MACHINES_PATH, JSON.stringify(machines, null, 2), 'utf-8');
}
exports.writeMachines = writeMachines;

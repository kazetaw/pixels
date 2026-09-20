"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readRecipes = readRecipes;
exports.readMachines = readMachines;
exports.readStocks = readStocks;
exports.readStockImages = readStockImages;
exports.writeStocks = writeStocks;
exports.writeStockImages = writeStockImages;
exports.writeRecipes = writeRecipes;
exports.writeMachines = writeMachines;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
// Data directory is at backend/data/ relative to this file's location (src/services/)
const DATA_DIR = path_1.default.resolve(__dirname, '../../data');
const RECIPES_PATH = path_1.default.join(DATA_DIR, 'recipes.json');
const MACHINES_PATH = path_1.default.join(DATA_DIR, 'machines.json');
const STOCKS_PATH = path_1.default.join(DATA_DIR, 'stocks.json');
const STOCK_IMAGES_PATH = path_1.default.join(DATA_DIR, 'stock_images.json');
/**
 * Read all recipes from recipes.json.
 * Throws if the file cannot be read or parsed.
 */
async function readRecipes() {
    const raw = await fs_1.promises.readFile(RECIPES_PATH, 'utf-8');
    return JSON.parse(raw);
}
/**
 * Read all machines from machines.json.
 * Throws if the file cannot be read or parsed.
 */
async function readMachines() {
    const raw = await fs_1.promises.readFile(MACHINES_PATH, 'utf-8');
    return JSON.parse(raw);
}
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
/**
 * Overwrite stocks.json with the provided stock map.
 * Creates the file if it doesn't exist.
 */
async function writeStocks(stocks) {
    await fs_1.promises.writeFile(STOCKS_PATH, JSON.stringify(stocks, null, 2), 'utf-8');
}
/**
 * Overwrite stock_images.json with the provided image map.
 */
async function writeStockImages(images) {
    await fs_1.promises.writeFile(STOCK_IMAGES_PATH, JSON.stringify(images, null, 2), 'utf-8');
}
/**
 * Overwrite recipes.json with the provided array.
 */
async function writeRecipes(recipes) {
    await fs_1.promises.writeFile(RECIPES_PATH, JSON.stringify(recipes, null, 2), 'utf-8');
}
/**
 * Overwrite machines.json with the provided array.
 */
async function writeMachines(machines) {
    await fs_1.promises.writeFile(MACHINES_PATH, JSON.stringify(machines, null, 2), 'utf-8');
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseTimeToHours = parseTimeToHours;
exports.hoursToTimeString = hoursToTimeString;
/**
 * Parse a "HH:MM:SS" string to decimal hours.
 * e.g. "07:05:53" → 7.0980555...
 * Returns 0 if the string is invalid or null.
 */
function parseTimeToHours(time) {
    if (!time)
        return 0;
    const parts = time.split(':');
    if (parts.length !== 3)
        return 0;
    const [h, m, s] = parts.map(Number);
    if ([h, m, s].some(isNaN))
        return 0;
    return h + m / 60 + s / 3600;
}
/**
 * Convert decimal hours back to "HH:MM:SS" string.
 * e.g. 7.0980555 → "07:05:53"
 */
function hoursToTimeString(hours) {
    const totalSeconds = Math.round(hours * 3600);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

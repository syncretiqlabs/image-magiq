const dotenv = require('dotenv');
dotenv.config();

function parseBool(value, def = false) {
  if (value === undefined || value === null || value === '') return def;
  const s = String(value).trim().toLowerCase();
  return ['1', 'true', 't', 'yes', 'y', 'on'].includes(s) ? true : ['0', 'false', 'f', 'no', 'n', 'off'].includes(s) ? false : def;
}

function parseIntSafe(value, def) {
  if (value === undefined || value === null || value === '') return def;
  const n = parseInt(String(value), 10);
  return Number.isFinite(n) ? n : def;
}

function parseList(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const config = {
  PORT: parseIntSafe(process.env.PORT, 3000),
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',

  API_KEYS: parseList(process.env.API_KEYS || process.env.API_KEY),

  DEFAULT_QUALITY: Math.min(100, Math.max(1, parseIntSafe(process.env.DEFAULT_QUALITY, 80))),
  DEFAULT_LOSSLESS: parseBool(process.env.DEFAULT_LOSSLESS, false),
  WEBP_EFFORT: Math.min(6, Math.max(0, parseIntSafe(process.env.WEBP_EFFORT, 4))),
  STRIP_METADATA: parseBool(process.env.STRIP_METADATA, true),

  MAX_UPLOAD_MB: Math.max(1, parseIntSafe(process.env.MAX_UPLOAD_MB, 10)),
  ALLOW_URL_FETCH: parseBool(process.env.ALLOW_URL_FETCH, false),
  REQUEST_TIMEOUT_MS: Math.max(1000, parseIntSafe(process.env.REQUEST_TIMEOUT_MS, 15000)),

  RATE_LIMIT_WINDOW_MS: Math.max(1000, parseIntSafe(process.env.RATE_LIMIT_WINDOW_MS, 60_000)),
  RATE_LIMIT_MAX: Math.max(1, parseIntSafe(process.env.RATE_LIMIT_MAX, 60)),

  CONCURRENCY: Math.max(0, parseIntSafe(process.env.CONCURRENCY, 2)),

  CACHE_DIR: process.env.CACHE_DIR || '',
  CACHE_TTL_SEC: Math.max(0, parseIntSafe(process.env.CACHE_TTL_SEC, 86_400)),
};

module.exports = { config };


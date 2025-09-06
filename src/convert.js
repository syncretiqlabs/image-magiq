const sharp = require('sharp');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const { config } = require('./config');

// Configure sharp concurrency if provided
if (config.CONCURRENCY && Number.isFinite(config.CONCURRENCY) && config.CONCURRENCY > 0) {
  sharp.concurrency(config.CONCURRENCY);
}

function normalizeFit(fit) {
  const allowed = new Set(['cover', 'contain', 'fill', 'inside', 'outside']);
  return allowed.has(fit) ? fit : 'cover';
}

async function sniffFormat(buffer) {
  const meta = await sharp(buffer, { failOnError: true }).metadata();
  return meta.format || null;
}

function buildWebpOptions(opts) {
  const { quality, lossless } = opts;
  const webp = { quality, lossless, effort: config.WEBP_EFFORT };
  return webp;
}

async function convertBufferToWebp(buffer, options = {}) {
  const { width, height, fit, stripMetadata = config.STRIP_METADATA } = options;
  const quality = Math.min(100, Math.max(1, options.quality || config.DEFAULT_QUALITY));
  const lossless = Boolean(options.lossless ?? config.DEFAULT_LOSSLESS);

  // Validate format by sniffing bytes via sharp metadata
  const fmt = await sniffFormat(buffer);
  if (!fmt || (fmt !== 'jpeg' && fmt !== 'png')) {
    const err = new Error('Unsupported image format. Only JPEG and PNG are allowed.');
    err.statusCode = 415;
    throw err;
  }

  let img = sharp(buffer, { failOnError: true, sequentialRead: true }).rotate();
  // Convert to sRGB if possible
  try { img = img.toColorspace('srgb'); } catch (_) { /* ignore */ }

  if (width || height) {
    img = img.resize({
      width: width ? Number(width) : undefined,
      height: height ? Number(height) : undefined,
      fit: normalizeFit(fit),
      withoutEnlargement: true,
    });
  }

  if (!stripMetadata) {
    img = img.withMetadata();
  }

  const webpOptions = buildWebpOptions({ quality, lossless });
  const { data, info } = await img.webp(webpOptions).toBuffer({ resolveWithObject: true });
  return { data, info };
}

function cacheEnabled() {
  return Boolean(config.CACHE_DIR);
}

function optionsHash(buffer, options) {
  const hash = crypto.createHash('sha256');
  hash.update(buffer);
  hash.update('\n');
  hash.update(JSON.stringify({
    q: Math.min(100, Math.max(1, options.quality || config.DEFAULT_QUALITY)),
    l: Boolean(options.lossless ?? config.DEFAULT_LOSSLESS),
    w: options.width || null,
    h: options.height || null,
    f: normalizeFit(options.fit),
    m: Boolean(options.stripMetadata ?? config.STRIP_METADATA),
    e: config.WEBP_EFFORT,
  }));
  return hash.digest('hex');
}

async function ensureCacheDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

function cachePathFor(hash) {
  return path.join(config.CACHE_DIR, `${hash}.webp`);
}

async function readCacheIfFresh(filePath) {
  try {
    const st = await fsp.stat(filePath);
    if (config.CACHE_TTL_SEC > 0) {
      const ageMs = Date.now() - st.mtimeMs;
      if (ageMs > config.CACHE_TTL_SEC * 1000) return null;
    }
    const data = await fsp.readFile(filePath);
    return data;
  } catch (_) {
    return null;
  }
}

async function writeCacheAtomic(filePath, data) {
  const dir = path.dirname(filePath);
  const tmp = path.join(dir, `.${path.basename(filePath)}.${crypto.randomUUID()}.tmp`);
  await fsp.writeFile(tmp, data);
  await fsp.rename(tmp, filePath);
}

async function convertWithOptionalCache(buffer, options = {}) {
  if (!cacheEnabled()) {
    return convertBufferToWebp(buffer, options);
  }
  await ensureCacheDir(config.CACHE_DIR);
  const key = optionsHash(buffer, options);
  const fp = cachePathFor(key);
  const cached = await readCacheIfFresh(fp);
  if (cached) {
    return { data: cached, info: { format: 'webp' } };
  }
  const { data, info } = await convertBufferToWebp(buffer, options);
  try {
    await writeCacheAtomic(fp, data);
  } catch (_) {
    // Ignore cache write errors
  }
  return { data, info };
}

module.exports = { convertBufferToWebp, convertWithOptionalCache };


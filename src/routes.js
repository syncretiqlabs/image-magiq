const express = require('express');
const multer = require('multer');
const path = require('path');
const { config } = require('./config');
const { asyncHandler } = require('./middleware');
const { convertWithOptionalCache } = require('./convert');
const { fetchUrlToBuffer } = require('./utils');

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: config.MAX_UPLOAD_MB * 1024 * 1024,
    files: 1,
  },
});

function parseOptions(req) {
  const q = req.query.quality ? parseInt(String(req.query.quality), 10) : undefined;
  const lossless = req.query.lossless !== undefined ? ['1', 'true', 'yes', 'on'].includes(String(req.query.lossless).toLowerCase()) : undefined;
  const width = req.query.width ? parseInt(String(req.query.width), 10) : undefined;
  const height = req.query.height ? parseInt(String(req.query.height), 10) : undefined;
  const fit = req.query.fit ? String(req.query.fit) : undefined;
  const stripMetadata = req.query.stripMetadata !== undefined ? ['1', 'true', 'yes', 'on'].includes(String(req.query.stripMetadata).toLowerCase()) : undefined;
  return { quality: q, lossless, width, height, fit, stripMetadata };
}

router.post('/convert', upload.single('file'), asyncHandler(async (req, res) => {
  const startedAt = Date.now();
  const url = req.query.url ? String(req.query.url) : undefined;
  let buffer;
  let baseName = 'image';

  if (req.file && req.file.buffer) {
    buffer = req.file.buffer;
    baseName = path.parse(req.file.originalname || 'image').name || 'image';
  } else if (url) {
    if (!config.ALLOW_URL_FETCH) {
      return res.status(400).json({ error: 'url_fetch_disabled', message: 'URL fetching is disabled on this server' });
    }
    buffer = await fetchUrlToBuffer(url);
    try {
      const u = new URL(url);
      const p = u.pathname || '';
      const n = path.basename(p);
      if (n) baseName = path.parse(n).name || baseName;
    } catch (_) {}
  } else {
    return res.status(400).json({ error: 'missing_input', message: 'Provide a multipart file (field "file") or url query parameter' });
  }

  const options = parseOptions(req);
  const { data, info } = await convertWithOptionalCache(buffer, options);

  const filename = `${baseName}.webp`;
  res.set('Content-Type', 'image/webp');
  res.set('Content-Disposition', `attachment; filename="${filename}"`);
  res.set('Cache-Control', 'no-store');
  res.set('X-Image-Input-Bytes', String(buffer.length));
  if (info && info.size) res.set('X-Image-Output-Bytes', String(info.size));
  if (req.id) res.set('X-Request-Id', String(req.id));

  res.status(200).send(data);

  if (req.log) {
    req.log.info({
      took_ms: Date.now() - startedAt,
      input_bytes: buffer.length,
      output_bytes: info && info.size ? info.size : data.length,
      src: req.file ? 'upload' : 'url',
    }, 'converted_to_webp');
  }
}));

module.exports = router;


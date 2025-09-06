const { config } = require('./config');

class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.statusCode = status;
    this.code = code || 'http_error';
  }
}

function ensureHttpUrl(url) {
  let u;
  try { u = new URL(url); } catch (_) {
    throw new HttpError(400, 'Invalid URL', 'invalid_url');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new HttpError(400, 'Only http/https URLs are allowed', 'invalid_url_scheme');
  }
  return u;
}

async function fetchUrlToBuffer(url) {
  const u = ensureHttpUrl(url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(u.toString(), { signal: controller.signal, redirect: 'follow' });
    if (!res.ok) {
      throw new HttpError(400, `Failed to fetch URL (status ${res.status})`, 'fetch_error');
    }
    const cl = res.headers.get('content-length');
    const maxBytes = config.MAX_UPLOAD_MB * 1024 * 1024;
    if (cl && Number(cl) > maxBytes) {
      throw new HttpError(413, 'Remote file too large', 'payload_too_large');
    }

    // Stream with size guard
    if (!res.body || !res.body.getReader) {
      // Fallback: read all
      const ab = await res.arrayBuffer();
      const buf = Buffer.from(ab);
      if (buf.length > maxBytes) throw new HttpError(413, 'Remote file too large', 'payload_too_large');
      return buf;
    }
    const reader = res.body.getReader();
    const chunks = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        controller.abort();
        throw new HttpError(413, 'Remote file too large', 'payload_too_large');
      }
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks);
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { HttpError, fetchUrlToBuffer, ensureHttpUrl };


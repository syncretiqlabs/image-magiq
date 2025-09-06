const { config } = require('./config');

function getApiKeyFromReq(req) {
  const headerKey = req.headers['x-api-key'];
  if (typeof headerKey === 'string' && headerKey) return headerKey;
  const auth = req.headers['authorization'];
  if (typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  return null;
}

function requireApiKey(req, res, next) {
  // Always enforce API key; if none configured, reject with clear message
  const provided = getApiKeyFromReq(req);
  if (!provided) {
    return res.status(401).json({ error: 'missing_api_key', message: 'Provide X-API-Key header or Authorization: Bearer' });
  }
  if (!Array.isArray(config.API_KEYS) || config.API_KEYS.length === 0) {
    return res.status(401).json({ error: 'api_not_configured', message: 'Server has no API_KEYS configured' });
  }
  const allowed = new Set(config.API_KEYS);
  if (!allowed.has(provided)) {
    return res.status(401).json({ error: 'invalid_api_key', message: 'API key not authorized' });
  }
  return next();
}

function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function errorHandler(err, req, res, _next) {
  const status = err.statusCode || err.status || 500;
  const code = err.code || err.type || 'internal_error';
  if (req.log) {
    req.log.error({ err }, 'request_error');
  }
  // If response already started, delegate to default handler
  if (res.headersSent) return res.end();
  res.status(status).json({ error: code, message: err.message || 'Unexpected error' });
}

module.exports = { requireApiKey, asyncHandler, errorHandler };


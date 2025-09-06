const express = require('express');
const pino = require('pino');
const pinoHttp = require('pino-http');
const rateLimit = require('express-rate-limit');
const { config } = require('./config');
const { requireApiKey, errorHandler } = require('./middleware');
const routes = require('./routes');

const logger = pino({ level: config.LOG_LEVEL });

const app = express();
app.set('trust proxy', true);

app.use(pinoHttp({
  logger,
  redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers'],
  customLogLevel: function (res, err) {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
}));

app.use(express.json({ limit: '2kb' }));

// Health check (no auth)
app.get('/healthz', (_req, res) => res.status(200).send('ok'));

// Basic rate limiting (applies to all following routes)
const limiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Require API key for conversion routes
app.use(requireApiKey);

// Routes
app.use(routes);

// Error handler
app.use(errorHandler);

app.listen(config.PORT, () => {
  logger.info({ port: config.PORT }, 'image-magiq listening');
});


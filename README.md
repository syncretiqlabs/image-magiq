# Image Magiq

Lightweight image converter service and CLI to convert JPG/PNG to WebP. Designed to be simple, fast, and configurable via environment variables. Exposes an HTTP API for programmatic use from your websites and a small CLI for batch processing folders.

## Features

- POST `/convert` to get WebP output
- Accepts multipart uploads or remote URL (optional)
- Configurable defaults (quality, lossless, resize, metadata stripping)
- Enforces API key auth, size limits, and rate limiting
- Streams through sharp/libvips for performance
- Optional on-disk cache of converted outputs
- Minimal Docker image for easy deployment

## Quick Start (Docker)

1) Create an `.env` file (or copy from `.env.example`). At minimum, set `API_KEYS`.

```
PORT=3000
API_KEYS=change-me-key
DEFAULT_QUALITY=80
DEFAULT_LOSSLESS=false
ALLOW_URL_FETCH=false
MAX_UPLOAD_MB=10
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=60
CONCURRENCY=2
REQUEST_TIMEOUT_MS=15000
STRIP_METADATA=true
LOG_LEVEL=info
# Optional disk cache (disabled when empty)
CACHE_DIR=
CACHE_TTL_SEC=86400
WEBP_EFFORT=4
```

2) Build and run

```
docker build -t image-magiq .
docker run --rm -p 3000:3000 --env-file .env image-magiq
```

3) Convert an image

```
curl -s -X POST \
  -H "X-API-Key: change-me-key" \
  -F "file=@./sample.jpg" \
  "http://localhost:3000/convert?quality=78" \
  --output sample.webp
```

Optional URL input (enable `ALLOW_URL_FETCH=true`):

```
curl -s -X POST \
  -H "X-API-Key: change-me-key" \
  "http://localhost:3000/convert?url=https://example.com/pic.png&lossless=true" \
  --output pic.webp
```

## API

- `POST /convert`
  - Upload a file with multipart field `file`, or pass `url` query param when `ALLOW_URL_FETCH=true`.
  - Query parameters:
    - `quality`: 1–100 (default `DEFAULT_QUALITY`)
    - `lossless`: true/false (default `DEFAULT_LOSSLESS`)
    - `width`: integer pixels
    - `height`: integer pixels
    - `fit`: `cover|contain|fill|inside|outside` (default `cover`)
    - `stripMetadata`: true/false (default `STRIP_METADATA`)
  - Response headers:
    - `Content-Type: image/webp`
    - `Content-Disposition: attachment; filename="<original>.webp"`
    - `X-Image-Input-Bytes`, `X-Image-Output-Bytes`, `X-Request-Id`

- `GET /healthz` – health check (no auth required).

### Authentication

All endpoints except `/healthz` require an API key.

Provide `X-API-Key: <key>` or `Authorization: Bearer <key>`.

Set one or more keys via `API_KEYS` (comma-separated).

### Limits and Validation

- `MAX_UPLOAD_MB` caps upload size and remote downloads.
- Input type is validated by decoding with sharp; only JPEG and PNG are accepted.
- Rate limiting is applied globally per `RATE_LIMIT_WINDOW_MS`/`RATE_LIMIT_MAX`.

## Disk Caching (Optional)

Set `CACHE_DIR` to enable a simple on-disk cache. The service hashes the original bytes and conversion options; if a matching result exists and is still fresh according to `CACHE_TTL_SEC`, it serves the cached WebP directly. This avoids recomputing for identical inputs (e.g., the same product image uploaded repeatedly or converted with the same options).

Pros:
- Saves CPU on repeated conversions
- Reduces latency for hot images

Trade-offs:
- Uses disk space; needs cleanup if you change options often
- Cache hits require identical bytes and identical options

Recommendation: leave disabled for one-off conversions or when your app stores the WebP version; enable when you expect frequent re-conversions of the same sources.

## CLI (Batch Convert)

Convert a whole folder to WebP:

```
npm start --prefix . --silent # installs not needed for CLI
node bin/convert-dir.js ./images --quality 80 --concurrency 4
```

Options:
- `--quality`, `--lossless`, `--width`, `--height`, `--fit`, `--stripMetadata`, `--force`, `--concurrency`

## Deployment Notes

- Docker base: `node:20-slim`. No root user at runtime.
- Set `API_KEYS` before exposing the service.
- Put behind a reverse proxy (Caddy/Nginx) if you want TLS and edge rate limiting.
- Tuning:
  - Small VPS: `CONCURRENCY=1..2`
  - `MAX_UPLOAD_MB` per your use-cases (10–20 MB typical)
  - `RATE_LIMIT_MAX` to curb abuse

## Dev

```
npm install
npm run dev
```


# Image Magiq - Complete Guide

## Table of Contents
- [Overview](#overview)
- [Installation](#installation)
- [Method 1: Batch Convert Script (CLI)](#method-1-batch-convert-script-cli)
- [Method 2: HTTP API](#method-2-http-api)
- [Configuration](#configuration)
- [Examples](#examples)
- [Troubleshooting](#troubleshooting)

---

## Overview

**Image Magiq** is a lightweight, high-performance image conversion service that converts JPG/PNG images to WebP format. It offers two ways to convert images:

1. **Batch Convert Script (CLI)** - Convert entire folders of images locally
2. **HTTP API** - Convert images via REST API for integration with web applications

### Key Features
- Fast conversion using Sharp/libvips
- Configurable quality, lossless mode, and resizing options
- Metadata stripping for smaller file sizes
- Concurrent processing for batch operations
- Optional disk caching for API mode
- API authentication and rate limiting

---

## Installation

### Prerequisites
- Node.js 18 or higher
- npm

### Install Dependencies

```bash
npm install
```

### Environment Setup

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` to set your configuration (see [Configuration](#configuration) section).

---

## Method 1: Batch Convert Script (CLI)

The batch convert script is perfect for converting entire folders of images locally without needing to run the API service.

### Basic Usage

```bash
node bin/batch-convert.js <source-directory>
```

This will:
- Recursively find all JPG/PNG images in the source directory
- Convert them to WebP format
- Save them in `<source-directory>-output` with the same folder structure

### Examples

#### Simple conversion
```bash
node bin/batch-convert.js ./my-photos
```
Creates: `./my-photos-output/` with all converted WebP images

#### With absolute path (including spaces)
```bash
node bin/batch-convert.js "/mnt/c/Users/bgbis/Downloads/nwwni photos"
```
Creates: `/mnt/c/Users/bgbis/Downloads/nwwni photos-output/`

#### Custom output directory
```bash
node bin/batch-convert.js ./photos --output ./converted-webp
```
Saves converted images to `./converted-webp/`

#### High quality conversion
```bash
node bin/batch-convert.js ./photos --quality 95 --lossless
```

#### Resize images during conversion
```bash
node bin/batch-convert.js ./photos --width 1920 --height 1080 --fit cover
```

#### Fast conversion with parallel processing
```bash
node bin/batch-convert.js ./photos --quality 80 --concurrency 8
```

#### Convert only a subset of images (random selection)
```bash
# From 100 images, randomly select and convert only 25
node bin/batch-convert.js ./photos --limit 25 --quality 85
```

### All CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `--output <dir>` | Output directory | `<source>-output` |
| `--limit <n>` | Randomly select and convert only N images from the source directory | (no limit) |
| `--quality <1-100>` | WebP quality (higher = better quality, larger file) | 80 |
| `--lossless` | Use lossless compression (ignores quality setting) | false |
| `--width <px>` | Resize width in pixels | (no resize) |
| `--height <px>` | Resize height in pixels | (no resize) |
| `--fit <mode>` | Resize fit mode: `cover`, `contain`, `fill`, `inside`, `outside` | `cover` |
| `--concurrency <n>` | Number of parallel workers | 4 |
| `--force` | Overwrite existing .webp files | false |
| `--stripMetadata` | Remove EXIF/metadata from images | false |
| `-h, --help` | Show help | - |

### What Gets Converted?

The script recursively searches for files with these extensions:
- `.jpg`
- `.jpeg`
- `.png`

All other files are ignored.

### Output Structure

The script preserves your folder structure. For example:

**Input:**
```
my-photos/
├── vacation/
│   ├── beach.jpg
│   └── sunset.png
├── family/
│   └── portrait.jpg
└── selfie.png
```

**Output:**
```
my-photos-output/
├── vacation/
│   ├── beach.webp
│   └── sunset.webp
├── family/
│   └── portrait.webp
└── selfie.webp
```

---

## Method 2: HTTP API

The HTTP API allows you to integrate image conversion into your web applications, microservices, or automated workflows.

### Starting the API Service

#### Using Node directly

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

The service will start on the port specified in `.env` (default: 3000).

#### Using Docker

```bash
# Build the image
docker build -f docker/Dockerfile -t image-magiq .

# Run the container
docker run --rm -p 3000:3000 --env-file .env image-magiq
```

#### Using Docker Compose

```bash
# Start the service
docker compose -f docker/docker-compose.yml up -d --build

# View logs
docker compose -f docker/docker-compose.yml logs -f

# Stop the service
docker compose -f docker/docker-compose.yml down
```

### Authentication Setup

The API requires authentication for all endpoints except `/healthz`.

#### Step 1: Generate API Keys

Choose strong, random API keys. You can generate them using:

```bash
# Linux/Mac
openssl rand -hex 32

# Or use any random string generator
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### Step 2: Configure API Keys

Edit your `.env` file and set the `API_KEYS` variable:

```env
# Single API key
API_KEYS=your-secret-key-here

# Multiple API keys (comma-separated)
API_KEYS=key-for-website,key-for-mobile-app,key-for-admin
```

**Important:**
- Never commit `.env` to version control
- Use different keys for different environments (dev/staging/production)
- Rotate keys periodically for security

### API Endpoints

#### POST `/convert`

Convert an image to WebP format.

**Authentication:**

Include one of the following headers:

```http
X-API-Key: your-secret-key-here
```

or

```http
Authorization: Bearer your-secret-key-here
```

**Two ways to send images:**

##### Option 1: Upload a file (multipart/form-data)

```bash
curl -X POST \
  -H "X-API-Key: your-secret-key-here" \
  -F "file=@./photo.jpg" \
  "http://localhost:3000/convert?quality=85" \
  --output photo.webp
```

##### Option 2: Provide a URL (requires ALLOW_URL_FETCH=true)

```bash
curl -X POST \
  -H "X-API-Key: your-secret-key-here" \
  "http://localhost:3000/convert?url=https://example.com/image.png&quality=90" \
  --output image.webp
```

**Query Parameters:**

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `quality` | 1-100 | WebP quality | `DEFAULT_QUALITY` (80) |
| `lossless` | boolean | Use lossless compression | `DEFAULT_LOSSLESS` (false) |
| `width` | integer | Resize width in pixels | (no resize) |
| `height` | integer | Resize height in pixels | (no resize) |
| `fit` | string | Resize fit: `cover`, `contain`, `fill`, `inside`, `outside` | `cover` |
| `stripMetadata` | boolean | Remove EXIF/metadata | `STRIP_METADATA` (true) |
| `url` | string | URL of image to fetch (requires `ALLOW_URL_FETCH=true`) | - |

**Response:**

- **Success (200):**
  - `Content-Type: image/webp`
  - `Content-Disposition: attachment; filename="<original-name>.webp"`
  - Headers:
    - `X-Image-Input-Bytes`: Original file size
    - `X-Image-Output-Bytes`: Converted file size
    - `X-Request-Id`: Unique request identifier

- **Error (4xx/5xx):**
  ```json
  {
    "error": "Error message description"
  }
  ```

**Example with JavaScript (fetch):**

```javascript
async function convertImage(file, quality = 80) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`http://localhost:3000/convert?quality=${quality}`, {
    method: 'POST',
    headers: {
      'X-API-Key': 'your-secret-key-here'
    },
    body: formData
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }

  const blob = await response.blob();
  return blob; // WebP image as Blob
}
```

**Example with Python:**

```python
import requests

def convert_image(file_path, api_key, quality=80):
    url = f"http://localhost:3000/convert?quality={quality}"
    headers = {"X-API-Key": api_key}

    with open(file_path, 'rb') as f:
        files = {'file': f}
        response = requests.post(url, headers=headers, files=files)

    if response.ok:
        with open('output.webp', 'wb') as out:
            out.write(response.content)
        print("Conversion successful!")
    else:
        print(f"Error: {response.json()['error']}")

convert_image('photo.jpg', 'your-secret-key-here', quality=85)
```

#### GET `/healthz`

Health check endpoint (no authentication required).

```bash
curl http://localhost:3000/healthz
```

**Response:**
```json
{
  "status": "ok"
}
```

### API Limits and Validation

The API enforces several limits for security and performance:

1. **Upload Size Limit**: Maximum file size (default: 10 MB)
   - Configure with `MAX_UPLOAD_MB` in `.env`

2. **Rate Limiting**: Global rate limit per time window
   - Configure with `RATE_LIMIT_WINDOW_MS` and `RATE_LIMIT_MAX` in `.env`
   - Default: 60 requests per 60 seconds

3. **Input Validation**:
   - Only JPEG and PNG formats are accepted
   - Files are validated by decoding with Sharp (not just by extension)

4. **Request Timeout**: Maximum processing time per request
   - Configure with `REQUEST_TIMEOUT_MS` in `.env`
   - Default: 15 seconds

---

## Configuration

All configuration is done via environment variables in the `.env` file.

### Required Settings

```env
# API Keys (comma-separated for multiple keys)
API_KEYS=your-secret-key-here,another-key
```

### Optional Settings

```env
# Server
PORT=3000                          # HTTP port
LOG_LEVEL=info                     # Logging: debug, info, warn, error

# Image Conversion Defaults
DEFAULT_QUALITY=80                 # Default WebP quality (1-100)
DEFAULT_LOSSLESS=false            # Default lossless mode
STRIP_METADATA=true               # Strip EXIF/metadata by default
WEBP_EFFORT=4                     # WebP compression effort (0-6, higher=slower but smaller)

# Limits
MAX_UPLOAD_MB=10                  # Maximum upload size
REQUEST_TIMEOUT_MS=15000          # Request timeout (15 seconds)
CONCURRENCY=2                     # Max concurrent conversions

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000        # Rate limit window (60 seconds)
RATE_LIMIT_MAX=60                 # Max requests per window

# URL Fetching (Optional)
ALLOW_URL_FETCH=false             # Allow converting images from URLs

# Disk Cache (Optional)
CACHE_DIR=                        # Cache directory path (empty = disabled)
CACHE_TTL_SEC=86400              # Cache TTL in seconds (24 hours)
```

### Configuration Tips

**For development:**
```env
LOG_LEVEL=debug
CONCURRENCY=1
ALLOW_URL_FETCH=true
```

**For production on small VPS:**
```env
LOG_LEVEL=info
CONCURRENCY=2
MAX_UPLOAD_MB=10
RATE_LIMIT_MAX=100
ALLOW_URL_FETCH=false
```

**For high-traffic production:**
```env
LOG_LEVEL=warn
CONCURRENCY=4
MAX_UPLOAD_MB=20
RATE_LIMIT_MAX=1000
CACHE_DIR=/var/cache/image-magiq
```

---

## Examples

### Example 1: Personal Photo Library

Convert your vacation photos with high quality:

```bash
node bin/batch-convert.js "/mnt/c/Users/yourname/Pictures/Vacation 2024" \
  --quality 90 \
  --stripMetadata \
  --concurrency 8
```

### Example 2: Website Integration

Convert user-uploaded images in your web application:

```javascript
// Express.js example
const express = require('express');
const multer = require('multer');
const fetch = require('node-fetch');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.post('/upload', upload.single('photo'), async (req, res) => {
  const formData = new FormData();
  formData.append('file', new Blob([req.file.buffer]), req.file.originalname);

  try {
    const response = await fetch('http://localhost:3000/convert?quality=85', {
      method: 'POST',
      headers: { 'X-API-Key': process.env.IMAGE_MAGIQ_KEY },
      body: formData
    });

    const webpBuffer = await response.buffer();

    // Save to S3, database, etc.
    // ...

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Example 3: E-commerce Product Images

Batch convert and resize product images:

```bash
node bin/batch-convert.js ./product-images \
  --output ./product-images-webp \
  --width 1200 \
  --height 1200 \
  --fit contain \
  --quality 85 \
  --stripMetadata \
  --concurrency 6
```

### Example 4: Automated Workflow

Convert images from a URL in a cron job or CI/CD pipeline:

```bash
#!/bin/bash
# convert-and-upload.sh

curl -X POST \
  -H "X-API-Key: ${IMAGE_MAGIQ_KEY}" \
  "http://localhost:3000/convert?url=https://cdn.example.com/source.jpg&quality=80" \
  --output converted.webp

# Upload to CDN
aws s3 cp converted.webp s3://my-bucket/images/
```

---

## Troubleshooting

### Script Issues

**Problem:** "Source directory does not exist"
```bash
# Solution: Use absolute path or ensure directory exists
node bin/batch-convert.js "/full/path/to/directory"
```

**Problem:** No images found
```bash
# Solution: Check that directory contains .jpg, .jpeg, or .png files
find ./your-directory -type f \( -name "*.jpg" -o -name "*.png" \)
```

**Problem:** "FAIL: unsupported image format"
```bash
# Solution: File might be corrupted or not a valid image
# Check file with: file yourimage.jpg
```

### API Issues

**Problem:** "Unauthorized" or "Missing API key"
```bash
# Solution: Ensure X-API-Key header matches a key in API_KEYS
curl -H "X-API-Key: your-key" ...
```

**Problem:** "Rate limit exceeded"
```bash
# Solution: Wait or increase RATE_LIMIT_MAX in .env
# Check current limits in your .env file
```

**Problem:** "File too large"
```bash
# Solution: Increase MAX_UPLOAD_MB in .env
MAX_UPLOAD_MB=20
```

**Problem:** Connection refused
```bash
# Solution: Ensure service is running
npm start
# Or check Docker: docker compose ps
```

### Performance Tips

1. **Adjust concurrency based on CPU cores:**
   ```bash
   # For quad-core CPU
   node bin/batch-convert.js ./images --concurrency 4
   ```

2. **Enable caching for repeated conversions:**
   ```env
   CACHE_DIR=/var/cache/image-magiq
   ```

3. **Use lower quality for faster conversion:**
   ```bash
   node bin/batch-convert.js ./images --quality 70
   ```

4. **Resize images for smaller files:**
   ```bash
   node bin/batch-convert.js ./images --width 1920 --quality 80
   ```

---

## Security Best Practices

1. **Never expose API keys in client-side code**
   - Use a backend proxy to add API keys server-side

2. **Use HTTPS in production**
   - Put behind nginx or Caddy with TLS certificates

3. **Restrict URL fetching**
   - Keep `ALLOW_URL_FETCH=false` unless absolutely needed
   - If enabled, implement URL allowlisting in your proxy

4. **Set appropriate rate limits**
   - Adjust based on your expected traffic

5. **Monitor disk usage**
   - If using CACHE_DIR, implement cache cleanup

6. **Run with least privileges**
   - Docker runs as non-root user by default

---

## Support

For issues, feature requests, or questions:
- Check existing documentation in README.md
- Review configuration examples in .env.example
- Check the code in src/ for implementation details

---

## License

Check the project repository for license information.

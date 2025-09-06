#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const minimist = require('minimist');
const { convertBufferToWebp } = require('../src/convert');

function usage(code = 0) {
  const msg = `
Usage: convert-dir <directory> [options]

Options:
  --quality <1-100>       WebP quality (default: env DEFAULT_QUALITY or 80)
  --lossless              Use lossless mode (default: env DEFAULT_LOSSLESS)
  --width <px>            Resize width
  --height <px>           Resize height
  --fit <cover|contain|fill|inside|outside>  Resize fit (default: cover)
  --concurrency <n>       Parallel workers (default: 4)
  --force                 Overwrite existing .webp files
  --stripMetadata         Strip metadata (default: env STRIP_METADATA)
  -h, --help              Show help
`;
  console.log(msg);
  process.exit(code);
}

async function walk(dir, list = []) {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      await walk(p, list);
    } else if (e.isFile()) {
      const ext = path.extname(e.name).toLowerCase();
      if (ext === '.jpg' || ext === '.jpeg' || ext === '.png') {
        list.push(p);
      }
    }
  }
  return list;
}

async function convertFile(src, options, force) {
  const dir = path.dirname(src);
  const base = path.parse(src).name;
  const dst = path.join(dir, `${base}.webp`);
  if (!force && fs.existsSync(dst)) return { src, dst, skipped: true };
  const buf = await fsp.readFile(src);
  const { data } = await convertBufferToWebp(buf, options);
  await fsp.writeFile(dst, data);
  return { src, dst, skipped: false };
}

async function run() {
  const argv = minimist(process.argv.slice(2));
  if (argv.h || argv.help) usage(0);
  const root = argv._[0];
  if (!root) usage(1);

  const options = {
    quality: argv.quality !== undefined ? parseInt(String(argv.quality), 10) : undefined,
    lossless: argv.lossless !== undefined,
    width: argv.width !== undefined ? parseInt(String(argv.width), 10) : undefined,
    height: argv.height !== undefined ? parseInt(String(argv.height), 10) : undefined,
    fit: argv.fit !== undefined ? String(argv.fit) : undefined,
    stripMetadata: argv.stripMetadata !== undefined ? true : undefined,
  };
  const concurrency = Math.max(1, parseInt(String(argv.concurrency || '4'), 10));
  const force = Boolean(argv.force);

  const files = await walk(root, []);
  console.log(`Found ${files.length} images under ${root}`);
  let idx = 0;
  let converted = 0;
  let skipped = 0;

  async function worker() {
    while (true) {
      const i = idx++;
      if (i >= files.length) return;
      const src = files[i];
      try {
        const res = await convertFile(src, options, force);
        if (res.skipped) skipped++; else converted++;
        console.log(`${res.skipped ? 'SKIP' : 'OK  '} ${path.relative(root, src)} -> ${path.relative(root, res.dst)}`);
      } catch (err) {
        console.error(`FAIL ${src}: ${err.message}`);
      }
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);
  console.log(`Done. Converted: ${converted}, Skipped: ${skipped}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});


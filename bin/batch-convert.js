#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const minimist = require('minimist');
const { convertBufferToWebp } = require('../src/convert');

function usage(code = 0) {
  const msg = `
Usage: batch-convert <source-directory> [options]

Converts all JPG/PNG images in source directory to WebP format and saves them
in an output directory while preserving the folder structure.

Arguments:
  <source-directory>      Source directory containing images to convert

Options:
  --output <dir>          Output directory (default: <source-directory>-output)
  --limit <n>             Randomly select and convert only N images
  --quality <1-100>       WebP quality (default: env DEFAULT_QUALITY or 80)
  --lossless              Use lossless mode (default: env DEFAULT_LOSSLESS)
  --width <px>            Resize width
  --height <px>           Resize height
  --fit <cover|contain|fill|inside|outside>  Resize fit (default: cover)
  --concurrency <n>       Parallel workers (default: 4)
  --force                 Overwrite existing .webp files
  --stripMetadata         Strip metadata (default: env STRIP_METADATA)
  -h, --help              Show help

Examples:
  batch-convert ./my-images
  batch-convert "/mnt/c/Users/name/Downloads/photos"
  batch-convert ./images --output ./converted --quality 90
  batch-convert ./images --limit 25 --quality 85
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

async function ensureDir(dir) {
  try {
    await fsp.mkdir(dir, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
}

function shuffleArray(array) {
  // Fisher-Yates shuffle algorithm
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

async function convertFile(src, srcRoot, outputRoot, options, force) {
  // Get relative path from source root
  const relativePath = path.relative(srcRoot, src);
  const parsedPath = path.parse(relativePath);

  // Build output path preserving directory structure
  const outputDir = path.join(outputRoot, parsedPath.dir);
  const outputFile = path.join(outputDir, `${parsedPath.name}.webp`);

  // Ensure output directory exists
  await ensureDir(outputDir);

  // Check if already exists
  if (!force && fs.existsSync(outputFile)) {
    return { src, dst: outputFile, skipped: true };
  }

  // Convert
  const buf = await fsp.readFile(src);
  const { data } = await convertBufferToWebp(buf, options);
  await fsp.writeFile(outputFile, data);

  return { src, dst: outputFile, skipped: false };
}

async function run() {
  const argv = minimist(process.argv.slice(2));
  if (argv.h || argv.help) usage(0);

  const srcRoot = argv._[0];
  if (!srcRoot) {
    console.error('Error: Source directory is required\n');
    usage(1);
  }

  // Resolve to absolute path
  const absSrcRoot = path.resolve(srcRoot);

  // Check if source exists
  try {
    const stat = await fsp.stat(absSrcRoot);
    if (!stat.isDirectory()) {
      console.error(`Error: ${srcRoot} is not a directory`);
      process.exit(1);
    }
  } catch (err) {
    console.error(`Error: Source directory ${srcRoot} does not exist`);
    process.exit(1);
  }

  // Determine output directory
  let outputRoot;
  if (argv.output) {
    outputRoot = path.resolve(argv.output);
  } else {
    // Auto-create output directory: <source-name>-output
    const srcDirName = path.basename(absSrcRoot);
    const srcParent = path.dirname(absSrcRoot);
    outputRoot = path.join(srcParent, `${srcDirName}-output`);
  }

  // Create output directory
  await ensureDir(outputRoot);

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
  const limit = argv.limit !== undefined ? Math.max(1, parseInt(String(argv.limit), 10)) : undefined;

  console.log(`Source:  ${absSrcRoot}`);
  console.log(`Output:  ${outputRoot}`);
  console.log('');

  let files = await walk(absSrcRoot, []);
  console.log(`Found ${files.length} images in source directory`);

  // Apply limit if specified
  if (limit !== undefined && limit < files.length) {
    files = shuffleArray(files).slice(0, limit);
    console.log(`Randomly selected ${limit} images to convert`);
  }

  console.log('');

  let idx = 0;
  let converted = 0;
  let skipped = 0;

  async function worker() {
    while (true) {
      const i = idx++;
      if (i >= files.length) return;
      const src = files[i];
      try {
        const res = await convertFile(src, absSrcRoot, outputRoot, options, force);
        if (res.skipped) skipped++; else converted++;
        const relSrc = path.relative(absSrcRoot, src);
        const relDst = path.relative(outputRoot, res.dst);
        console.log(`${res.skipped ? 'SKIP' : 'OK  '} ${relSrc} -> ${relDst}`);
      } catch (err) {
        console.error(`FAIL ${path.relative(absSrcRoot, src)}: ${err.message}`);
      }
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  console.log('');
  console.log(`Done. Converted: ${converted}, Skipped: ${skipped}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

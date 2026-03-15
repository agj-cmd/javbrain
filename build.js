#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const CONTENT_DIR = path.join(__dirname, 'content');
const DIST_DIR = path.join(__dirname, 'docs');
const FILES_DIR = path.join(DIST_DIR, 'files');
const PREVIEW_LENGTH = 200;
const INDEX_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB

// Font scanning config
const FONT_EXTS = { '.woff2': 'woff2', '.woff': 'woff', '.ttf': 'truetype', '.otf': 'opentype' };
const VARIANT_MAP = {
  'regular':    { weight: 'normal', style: 'normal' },
  'italic':     { weight: 'normal', style: 'italic' },
  'bold':       { weight: 'bold',   style: 'normal' },
  'bolditalic': { weight: 'bold',   style: 'italic' },
};
const FORMAT_PRIORITY = { 'woff2': 0, 'woff': 1, 'opentype': 2, 'truetype': 3 };

// Clean old output
if (fs.existsSync(FILES_DIR)) {
  fs.rmSync(FILES_DIR, { recursive: true });
}
// Clean old index/data files
if (fs.existsSync(DIST_DIR)) {
  for (const f of fs.readdirSync(DIST_DIR)) {
    if (f.endsWith('.json') || f === 'index.html' || f === 'viewer.html') {
      fs.unlinkSync(path.join(DIST_DIR, f));
    }
  }
}

// Ensure output dirs
fs.mkdirSync(DIST_DIR, { recursive: true });
fs.mkdirSync(FILES_DIR, { recursive: true });

// Read all .txt and .jav files
const exts = new Set(['.txt', '.jav']);
const files = fs.readdirSync(CONTENT_DIR)
  .filter(f => exts.has(path.extname(f).toLowerCase()))
  .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

if (files.length === 0) {
  console.log('No .txt or .jav files found in content/. Add files and re-run.');
  process.exit(0);
}

const data = [];
const invertedIndex = Object.create(null);

files.forEach((filename, i) => {
  const filepath = path.join(CONTENT_DIR, filename);
  const stat = fs.statSync(filepath);
  const content = fs.readFileSync(filepath, 'utf-8');

  // Metadata + preview
  data.push({
    filename,
    preview: content.slice(0, PREVIEW_LENGTH).replace(/\n/g, ' '),
    modified: stat.mtime.toISOString().split('T')[0],
    ext: path.extname(filename).toLowerCase()
  });

  // Write full content to dist/files/{i}.txt
  fs.writeFileSync(path.join(FILES_DIR, `${i}.txt`), content, 'utf-8');

  // Build inverted index (content + filename)
  const combined = filename.toLowerCase() + '\n' + content.toLowerCase();
  const lower = combined;
  const words = new Set(lower.match(/[a-z0-9]+/g) || []);
  for (const word of words) {
    if (!invertedIndex[word]) invertedIndex[word] = [];
    // Collect all char offsets for this word in this file
    const offsets = [];
    let pos = 0;
    while (true) {
      const idx = lower.indexOf(word, pos);
      if (idx === -1) break;
      offsets.push(idx);
      pos = idx + 1;
    }
    invertedIndex[word].push({ file: i, offsets });
  }
});

// Write data.json
fs.writeFileSync(path.join(DIST_DIR, 'data.json'), JSON.stringify(data), 'utf-8');

// Write index — split into chunks if too large
const indexStr = JSON.stringify(invertedIndex);
if (indexStr.length <= INDEX_CHUNK_SIZE) {
  fs.writeFileSync(path.join(DIST_DIR, 'index.json'), indexStr, 'utf-8');
  console.log(`Built: ${files.length} files, index.json (${(indexStr.length / 1024).toFixed(1)}KB)`);
} else {
  // Split alphabetically
  const chunks = {};
  for (const [word, entries] of Object.entries(invertedIndex)) {
    const letter = word[0] || '_';
    if (!chunks[letter]) chunks[letter] = {};
    chunks[letter][word] = entries;
  }
  const manifest = {};
  for (const [letter, chunk] of Object.entries(chunks)) {
    const chunkFile = `index-${letter}.json`;
    fs.writeFileSync(path.join(DIST_DIR, chunkFile), JSON.stringify(chunk), 'utf-8');
    manifest[letter] = chunkFile;
  }
  fs.writeFileSync(path.join(DIST_DIR, 'index-manifest.json'), JSON.stringify(manifest), 'utf-8');
  console.log(`Built: ${files.length} files, ${Object.keys(chunks).length} index chunks`);
}

// Build version for cache busting
const buildVer = Date.now().toString(36);

// --- Scan fonts/ and generate fontfaces.json ---
const fontsSrc = path.join(__dirname, 'fonts');
const fontsDst = path.join(DIST_DIR, 'fonts');
const fontFamilies = {};

if (fs.existsSync(fontsSrc)) {
  fs.mkdirSync(fontsDst, { recursive: true });

  for (const f of fs.readdirSync(fontsSrc)) {
    const ext = path.extname(f).toLowerCase();
    const format = FONT_EXTS[ext];

    // Copy all font files to dist regardless of whether we can parse them
    fs.copyFileSync(path.join(fontsSrc, f), path.join(fontsDst, f));

    if (!format) continue;

    const base = path.basename(f, ext);
    const dashIdx = base.lastIndexOf('-');
    if (dashIdx < 0) continue; // no variant suffix — skip indexing

    const familyKey = base.slice(0, dashIdx);
    const variantStr = base.slice(dashIdx + 1).toLowerCase();
    const variant = VARIANT_MAP[variantStr];
    if (!variant) continue; // unrecognized variant — skip indexing

    if (!fontFamilies[familyKey]) fontFamilies[familyKey] = {};
    const faceKey = variant.weight + '-' + variant.style;
    if (!fontFamilies[familyKey][faceKey]) {
      fontFamilies[familyKey][faceKey] = { weight: variant.weight, style: variant.style, src: [] };
    }
    fontFamilies[familyKey][faceKey].src.push({ url: 'fonts/' + f, format });
  }
}

// Sort src entries by format priority (woff2 first), build output array
const fontfaces = Object.entries(fontFamilies)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([family, faces]) => ({
    family,
    faces: Object.values(faces).map(face => ({
      weight: face.weight,
      style: face.style,
      src: face.src.sort((a, b) => (FORMAT_PRIORITY[a.format] || 99) - (FORMAT_PRIORITY[b.format] || 99))
    }))
  }));

fs.writeFileSync(path.join(DIST_DIR, 'fontfaces.json'), JSON.stringify(fontfaces), 'utf-8');
console.log(`Fonts: ${fontfaces.length} families from fonts/ → fontfaces.json`);

// --- Copy and inject version into HTML files ---
const htmlSrc = path.join(__dirname, 'index.html');
const themesSrc = path.join(__dirname, 'themes.json');
if (fs.existsSync(htmlSrc)) {
  let html = fs.readFileSync(htmlSrc, 'utf-8');
  html = html.replace(/__BUILD_VER__/g, buildVer);
  fs.writeFileSync(path.join(DIST_DIR, 'index.html'), html, 'utf-8');
}
if (fs.existsSync(themesSrc)) {
  fs.copyFileSync(themesSrc, path.join(DIST_DIR, 'themes.json'));
}

// Copy viewer.html to dist
const viewerSrc = path.join(__dirname, 'viewer.html');
if (fs.existsSync(viewerSrc)) {
  let html = fs.readFileSync(viewerSrc, 'utf-8');
  html = html.replace(/__BUILD_VER__/g, buildVer);
  fs.writeFileSync(path.join(DIST_DIR, 'viewer.html'), html, 'utf-8');
}

console.log('Done. Deploy dist/ folder.');
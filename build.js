#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const CONTENT_DIR = path.join(__dirname, 'content');
const DIST_DIR = path.join(__dirname, 'docs');
const FILES_DIR = path.join(DIST_DIR, 'files');
const PREVIEW_LENGTH = 200;
const INDEX_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB

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
const invertedIndex = {};

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

// Clean up old index files
const oldIndex = path.join(DIST_DIR, 'index.json');
const oldManifest = path.join(DIST_DIR, 'index-manifest.json');
if (fs.existsSync(oldIndex)) fs.unlinkSync(oldIndex);
if (fs.existsSync(oldManifest)) fs.unlinkSync(oldManifest);
const oldChunks = fs.readdirSync(DIST_DIR).filter(f => f.match(/^index-[a-z0-9]\.json$/));
for (const f of oldChunks) fs.unlinkSync(path.join(DIST_DIR, f));

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

// Copy index.html and themes.json to dist
const htmlSrc = path.join(__dirname, 'index.html');
const themesSrc = path.join(__dirname, 'themes.json');
if (fs.existsSync(htmlSrc)) {
  fs.copyFileSync(htmlSrc, path.join(DIST_DIR, 'index.html'));
}
if (fs.existsSync(themesSrc)) {
  fs.copyFileSync(themesSrc, path.join(DIST_DIR, 'themes.json'));
}

// Copy viewer.html to dist
const viewerSrc = path.join(__dirname, 'viewer.html');
if (fs.existsSync(viewerSrc)) {
  fs.copyFileSync(viewerSrc, path.join(DIST_DIR, 'viewer.html'));
}

// Copy fonts/ to dist/fonts/
const fontsSrc = path.join(__dirname, 'fonts');
const fontsDst = path.join(DIST_DIR, 'fonts');
if (fs.existsSync(fontsSrc)) {
  fs.mkdirSync(fontsDst, { recursive: true });
  for (const f of fs.readdirSync(fontsSrc)) {
    fs.copyFileSync(path.join(fontsSrc, f), path.join(fontsDst, f));
  }
}

console.log('Done. Deploy dist/ folder.');
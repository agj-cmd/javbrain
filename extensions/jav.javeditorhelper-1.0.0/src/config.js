const vscode = require('vscode');
const { loadList, resolvePath } = require('./utils/fileLoader');

const capListKey = 'JavEditorHelper.capitalizationFilePaths';
const punctKey = 'JavEditorHelper.punctuationCharacters';

// ── glossary cache ──────────────────────────────────────────────

let glossaryCache = null;

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compileGlossary(raw) {
  const entries = [];
  for (const t of raw || []) {
    const term = String(t || '').trim();
    if (!term) continue;
    const starred = term.startsWith('*') && term.endsWith('*');
    const inner = term.replace(/^\*|\*$/g, '');
    if (!inner) continue;

    const pat = escapeRegex(inner).replace(/\s+/g, '\\s+');
    const isI = inner.toLowerCase() === 'i';

    // pre-compiled regex for normalizeCase
    let normRe;
    if (isI) {
      normRe = new RegExp(
        String.raw`(?<!\p{L})(\*+)?(${pat})(\*+)?(?!\p{L})`, 'giu'
      );
    } else {
      normRe = new RegExp(
        String.raw`(?<!\p{L})(\*+)?(${pat})(?:('s|s))?(\*+)?(?!\p{L})`, 'giu'
      );
    }

    // pre-compiled regex for enforceStars (only used when starred)
    let starRe = null;
    if (starred) {
      starRe = new RegExp(
        String.raw`(?<!\p{L})(?:\*+)?(${pat})(?:('s|s))?(?:\*+)?(?!\p{L})`, 'giu'
      );
    }

    entries.push({ key: inner, starred, normRe, starRe, hasSuffix: !isI });
  }
  entries.sort((a, b) => b.key.length - a.key.length);
  return entries;
}

function getGlossary() {
  if (glossaryCache) return glossaryCache;
  const paths = vscode.workspace.getConfiguration().get(capListKey, []);
  const rawList = Array.isArray(paths)
    ? paths.flatMap(p => loadList(p))
    : loadList(paths);
  glossaryCache = compileGlossary(rawList);
  return glossaryCache;
}

function glossaryCacheInvalidate() {
  glossaryCache = null;
}

// ── file watchers ───────────────────────────────────────────────

let watchers = [];

function watchersSetup(context) {
  watchersTeardown();
  const paths = vscode.workspace.getConfiguration().get(capListKey, []);
  const list = Array.isArray(paths) ? paths : [paths];
  for (const p of list) {
    if (!p) continue;
    try {
      const resolved = resolvePath(p);
      if (!resolved) continue;

      let pattern;
      const fs = require('fs');
      if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
        // directory → watch all files inside
        pattern = new vscode.RelativePattern(vscode.Uri.file(resolved), '**');
      } else {
        // file → watch that specific file
        const dir = require('path').dirname(resolved);
        const base = require('path').basename(resolved);
        pattern = new vscode.RelativePattern(vscode.Uri.file(dir), base);
      }

      const watcher = vscode.workspace.createFileSystemWatcher(pattern);
      watcher.onDidChange(() => glossaryCacheInvalidate());
      watcher.onDidCreate(() => glossaryCacheInvalidate());
      watcher.onDidDelete(() => glossaryCacheInvalidate());
      context.subscriptions.push(watcher);
      watchers.push(watcher);
    } catch (_) {}
  }
}

function watchersTeardown() {
  for (const w of watchers) {
    try { w.dispose(); } catch (_) {}
  }
  watchers = [];
}

// ── punctuation (unchanged) ─────────────────────────────────────

function getCustomList() {
  const paths = vscode.workspace.getConfiguration().get(capListKey, []);
  if (!Array.isArray(paths)) return loadList(paths);
  return paths.flatMap(p => loadList(p));
}

function getPunctuationCharacters() {
  const def = `,\.!\?'";:""''`;
  const raw = vscode.workspace.getConfiguration().get(punctKey, def);
  const escaped = raw.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  return new RegExp(`[${escaped}]`, 'gu');
}

module.exports = {
  capListKey,
  getCustomList,
  getGlossary,
  glossaryCacheInvalidate,
  watchersSetup,
  punctKey,
  getPunctuationCharacters
};
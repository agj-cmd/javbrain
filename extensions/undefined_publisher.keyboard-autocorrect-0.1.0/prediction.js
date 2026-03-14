const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

// --- n-gram tables ---
// bigram: "word1" → Map<"word2", count>
// trigram: "word1 word2" → Map<"word3", count>

/** @type {Map<string, Map<string, number>>} */
let bigrams = new Map();

/** @type {Map<string, Map<string, number>>} */
let trigrams = new Map();

/** @type {vscode.FileSystemWatcher[]} */
let corpusWatchers = [];

/**
 * Tokenize text into lowercase words array.
 * @param {string} text
 * @returns {string[]}
 */
function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z'\-\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 0);
}

/**
 * Add a count to an n-gram table.
 * @param {Map<string, Map<string, number>>} table
 * @param {string} key
 * @param {string} next
 */
function ngramAdd(table, key, next) {
  let followers = table.get(key);
  if (!followers) {
    followers = new Map();
    table.set(key, followers);
  }
  followers.set(next, (followers.get(next) || 0) + 1);
}

/**
 * Resolve a path using VS Code variables and workspace-relative logic.
 * Imported from main extension logic pattern.
 * @param {string} p
 * @returns {string}
 */
function pathResolve(p) {
  const os = require('os');
  const vars = {
    'execDir': path.resolve(vscode.env.appRoot, '..', '..'),
    'userHome': os.homedir(),
  };

  const folders = vscode.workspace.workspaceFolders;
  if (folders && folders.length > 0) {
    vars['workspaceFolder'] = folders[0].uri.fsPath;
    vars['workspaceFolderBasename'] = path.basename(folders[0].uri.fsPath);
  }

  let resolved = p;
  for (const [key, val] of Object.entries(vars)) {
    resolved = resolved.split('${' + key + '}').join(val);
  }

  if (resolved.startsWith('~')) {
    resolved = path.join(os.homedir(), resolved.slice(1));
  }

  if (!path.isAbsolute(resolved)) {
    if (folders && folders.length > 0) {
      resolved = path.join(folders[0].uri.fsPath, resolved);
    }
  }

  return resolved;
}

/**
 * Collect all file paths from a resolved path (file or directory).
 * @param {string} resolved
 * @returns {string[]}
 */
function filePathsCollect(resolved) {
  const results = [];
  try {
    if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
      const entries = fs.readdirSync(resolved);
      for (const entry of entries) {
        const full = path.join(resolved, entry);
        if (fs.statSync(full).isFile()) results.push(full);
      }
    } else {
      results.push(resolved);
    }
  } catch { /* skip */ }
  return results;
}

/**
 * Load corpus files and build bigram/trigram tables.
 */
function corpusLoad() {
  bigrams.clear();
  trigrams.clear();

  const cfg = vscode.workspace.getConfiguration('autocorrect');
  const paths = cfg.get('predictionCorpusPaths', []);

  for (const p of paths) {
    try {
      const resolved = pathResolve(p);
      const filePaths = filePathsCollect(resolved);

      for (const fp of filePaths) {
        const text = fs.readFileSync(fp, 'utf8');
        const words = tokenize(text);

        for (let i = 0; i < words.length - 1; i++) {
          ngramAdd(bigrams, words[i], words[i + 1]);

          if (i < words.length - 2) {
            const triKey = words[i] + ' ' + words[i + 1];
            ngramAdd(trigrams, triKey, words[i + 2]);
          }
        }
      }
    } catch (e) {
      vscode.window.showWarningMessage(`Autocorrect prediction: failed to load corpus "${p}": ${e.message}`);
    }
  }
}

/**
 * Get top N predictions given previous word(s).
 * Trigram priority, bigram fallback.
 * @param {string} prev1 - word at position -2 (or empty)
 * @param {string} prev2 - word at position -1 (most recent)
 * @param {string} prefix - partial current word being typed (can be empty)
 * @param {number} max
 * @returns {{word: string, score: number}[]}
 */
function predictionsGet(prev1, prev2, prefix, max) {
  const results = new Map(); // word → score

  // trigram lookup
  if (prev1 && prev2) {
    const triKey = prev1.toLowerCase() + ' ' + prev2.toLowerCase();
    const triFollowers = trigrams.get(triKey);
    if (triFollowers) {
      for (const [word, count] of triFollowers) {
        if (prefix && !word.startsWith(prefix.toLowerCase())) continue;
        results.set(word, (results.get(word) || 0) + count * 3); // weight trigrams higher
      }
    }
  }

  // bigram lookup
  if (prev2) {
    const biFollowers = bigrams.get(prev2.toLowerCase());
    if (biFollowers) {
      for (const [word, count] of biFollowers) {
        if (prefix && !word.startsWith(prefix.toLowerCase())) continue;
        results.set(word, (results.get(word) || 0) + count);
      }
    }
  }

  return Array.from(results.entries())
    .map(([word, score]) => ({ word, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, max);
}

/**
 * Extract previous words from line text before cursor.
 * @param {string} textBefore - text on the line before cursor
 * @returns {{prev1: string, prev2: string, prefix: string}}
 */
function contextExtract(textBefore) {
  // split into tokens; last token might be a partial word (prefix)
  const tokens = textBefore.split(/\s+/).filter(t => t.length > 0);

  // if line ends with space, no partial prefix — predict full next word
  const endsWithSpace = /\s$/.test(textBefore);

  if (endsWithSpace) {
    const prev2 = tokens.length >= 1 ? tokens[tokens.length - 1] : '';
    const prev1 = tokens.length >= 2 ? tokens[tokens.length - 2] : '';
    return { prev1, prev2, prefix: '' };
  } else {
    // last token is partial prefix being typed
    const prefix = tokens.length >= 1 ? tokens[tokens.length - 1] : '';
    const prev2 = tokens.length >= 2 ? tokens[tokens.length - 2] : '';
    const prev1 = tokens.length >= 3 ? tokens[tokens.length - 3] : '';
    return { prev1, prev2, prefix };
  }
}

/**
 * Create and register the CompletionItemProvider.
 * @param {vscode.ExtensionContext} context
 */
function predictionProviderRegister(context) {
  const provider = vscode.languages.registerCompletionItemProvider(
    { scheme: 'file' },
    {
      provideCompletionItems(document, position) {
        const cfg = vscode.workspace.getConfiguration('autocorrect');
        if (!cfg.get('predictionEnabled', true)) return [];

        const languageIds = cfg.get('languageIds', ['jav', 'markdown', 'plaintext']);
        if (!languageIds.includes(document.languageId)) return [];

        if (bigrams.size === 0) return [];

        const lineText = document.lineAt(position.line).text;
        const textBefore = lineText.substring(0, position.character);

        const { prev1, prev2, prefix } = contextExtract(textBefore);
        if (!prev2 && !prefix) return [];

        const maxSuggestions = cfg.get('predictionMaxSuggestions', 5);
        const predictions = predictionsGet(prev1, prev2, prefix, maxSuggestions);
        if (predictions.length === 0) return [];

        return predictions.map((pred, i) => {
          const item = new vscode.CompletionItem(
            pred.word,
            vscode.CompletionItemKind.Text
          );
          item.detail = `prediction (score: ${pred.score})`;
          item.insertText = pred.word + ' ';
          item.sortText = String(i).padStart(4, '0'); // preserve rank order
          // if there's a prefix, replace it; otherwise insert whole word
          if (prefix) {
            const startCol = position.character - prefix.length;
            item.range = new vscode.Range(
              new vscode.Position(position.line, startCol),
              position
            );
          }
          return item;
        });
      }
    },
    ' ', '.', ',', '!', '?', ';', ':' // trigger characters
  );

  context.subscriptions.push(provider);
}

/**
 * Resolve corpus paths for watching.
 * @returns {string[]}
 */
function corpusPathsResolve() {
  const cfg = vscode.workspace.getConfiguration('autocorrect');
  const paths = cfg.get('predictionCorpusPaths', []);
  return paths.map(p => pathResolve(p));
}

/**
 * Create file watchers for corpus files.
 * @param {vscode.ExtensionContext} context
 */
function corpusWatchersCreate(context) {
  for (const w of corpusWatchers) w.dispose();
  corpusWatchers = [];

  const paths = corpusPathsResolve();
  for (const p of paths) {
    let pattern;
    try {
      if (fs.existsSync(p) && fs.statSync(p).isDirectory()) {
        pattern = new vscode.RelativePattern(vscode.Uri.file(p), '*');
      } else {
        pattern = new vscode.RelativePattern(
          vscode.Uri.file(path.dirname(p)),
          path.basename(p)
        );
      }
    } catch {
      continue;
    }

    const watcher = vscode.workspace.createFileSystemWatcher(pattern);
    watcher.onDidChange(() => corpusLoad());
    watcher.onDidCreate(() => corpusLoad());
    watcher.onDidDelete(() => corpusLoad());
    corpusWatchers.push(watcher);
    context.subscriptions.push(watcher);
  }
}

module.exports = {
  corpusLoad,
  corpusWatchersCreate,
  predictionProviderRegister,
};
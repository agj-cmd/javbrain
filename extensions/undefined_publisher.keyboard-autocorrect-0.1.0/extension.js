const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const prediction = require('./prediction');

// --- built-in sample dictionary (~200 common words) ---
const DICTIONARY_BUILTIN = [
  'a','an','the','i','me','my','we','us','our','you','your','he','him','his',
  'she','her','it','its','they','them','their','this','that','these','those',
  'in','on','at','to','for','of','with','from','by','as','is','was','are',
  'were','be','been','being','have','has','had','do','does','did','will',
  'would','shall','should','can','could','may','might','must','not','no',
  'and','or','but','if','then','else','when','where','what','which','who',
  'how','all','each','every','both','few','more','most','other','some','any',
  'such','only','own','same','than','too','very','just','about','above',
  'after','again','also','always','am','an','another','because','before',
  'below','between','come','came','day','even','first','get','got','go',
  'went','gone','give','gave','given','good','great','here','there','into',
  'know','knew','known','last','let','like','long','look','make','made',
  'man','many','much','new','now','old','one','two','three','four','five',
  'over','part','people','place','point','right','say','said','see','saw',
  'still','take','took','tell','told','thing','think','thought','time',
  'under','up','down','use','used','want','way','well','work','world',
  'year','back','call','called','change','end','find','found','hand','help',
  'high','home','house','keep','kept','kind','large','left','life','line',
  'little','live','long','look','move','name','need','next','number','off',
  'open','order','own','play','put','read','run','set','show','small',
  'start','state','still','story','study','turn','through','try','while',
  'without','word','write','wrote','written','young',
  'function','return','value','string','array','object','class','method',
  'variable','parameter','argument','boolean','number','null','undefined',
  'error','file','data','list','index','loop','import','export','module',
  'package','public','private','static','void','interface','implement',
  'abstract','final','const','todo','fixme','hack','note','bug','test',
  'check','update','delete','create','remove','add','init','config',
  'default','true','false','type','code','comment','debug','print','log',
  'input','output','result','response','request','server','client','api',
  'database','table','query','field','record','key','map','filter','sort',
  'parse','format','convert','validate','handle','process','send','receive'
];

// --- correction presets ---
const PRESETS = {
  strict: {
    costTransposition: 0.3,
    costInsertDelete: 1.2,
    costSubstitutionMax: 1.5,
    costLengthPenalty: 0.8,
    lengthFilterMax: 2,
    thresholdBase: 1.5,
    thresholdScale: 0.4,
    lengthWordMin: 2,
  },
  balanced: {
    costTransposition: 0.5,
    costInsertDelete: 1.0,
    costSubstitutionMax: 2.0,
    costLengthPenalty: 0.5,
    lengthFilterMax: 3,
    thresholdBase: 2.0,
    thresholdScale: 0.6,
    lengthWordMin: 1,
  },
  aggressive: {
    costTransposition: 0.8,
    costInsertDelete: 0.8,
    costSubstitutionMax: 2.5,
    costLengthPenalty: 0.3,
    lengthFilterMax: 4,
    thresholdBase: 2.5,
    thresholdScale: 0.8,
    lengthWordMin: 1,
  },
};

/** @type {Map<string, {x: number, y: number}>} */
let keyCoordMap = new Map();

/** @type {Set<string>} */
let dictionary = new Set();

/** @type {string[]} */
let dictionaryArray = [];

/** @type {Map<string, string>} lowercase → original casing from dictionary files */
let dictionaryCasing = new Map();

/** @type {boolean} */
let correcting = false;

/**
 * Resolve active tuning parameters from preset or custom config.
 * @returns {object}
 */
function tuningResolve() {
  const cfg = vscode.workspace.getConfiguration('autocorrect');
  const preset = cfg.get('correctionPreset', 'balanced');

  if (preset !== 'custom' && PRESETS[preset]) {
    return { ...PRESETS[preset] };
  }

  return {
    costTransposition: cfg.get('costTransposition', PRESETS.balanced.costTransposition),
    costInsertDelete: cfg.get('costInsertDelete', PRESETS.balanced.costInsertDelete),
    costSubstitutionMax: cfg.get('costSubstitutionMax', PRESETS.balanced.costSubstitutionMax),
    costLengthPenalty: cfg.get('costLengthPenalty', PRESETS.balanced.costLengthPenalty),
    lengthFilterMax: cfg.get('lengthFilterMax', PRESETS.balanced.lengthFilterMax),
    thresholdBase: cfg.get('thresholdBase', PRESETS.balanced.thresholdBase),
    thresholdScale: cfg.get('thresholdScale', PRESETS.balanced.thresholdScale),
    lengthWordMin: cfg.get('lengthWordMin', PRESETS.balanced.lengthWordMin),
  };
}

/**
 * Build (x,y) coordinate map from keyboard layout string.
 * @param {string} layout
 */
function keyCoordMapBuild(layout) {
  keyCoordMap.clear();
  const rows = layout.split('\n').map(l => l.replace(/\r$/, ''));
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      const ch = rows[y][x].toLowerCase();
      if (!keyCoordMap.has(ch)) {
        keyCoordMap.set(ch, { x, y });
      }
    }
  }
}

/**
 * Euclidean distance between two keys.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function keyDistance(a, b) {
  const ca = keyCoordMap.get(a.toLowerCase());
  const cb = keyCoordMap.get(b.toLowerCase());
  if (!ca || !cb) return 2;
  const dx = ca.x - cb.x;
  const dy = ca.y - cb.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Weighted Damerau-Levenshtein distance.
 * @param {string} src
 * @param {string} tgt
 * @param {object} tuning
 * @returns {number}
 */
function levenshteinWeighted(src, tgt, tuning) {
  const m = src.length;
  const n = tgt.length;
  if (m === 0) return n * tuning.costInsertDelete;
  if (n === 0) return m * tuning.costInsertDelete;

  if (Math.abs(m - n) > tuning.lengthFilterMax) return Infinity;

  const dp = Array.from({ length: m + 1 }, () => new Float64Array(n + 1));

  for (let i = 0; i <= m; i++) dp[i][0] = i * tuning.costInsertDelete;
  for (let j = 0; j <= n; j++) dp[0][j] = j * tuning.costInsertDelete;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const substCost = src[i - 1] === tgt[j - 1]
        ? 0
        : Math.min(keyDistance(src[i - 1], tgt[j - 1]), tuning.costSubstitutionMax);
      dp[i][j] = Math.min(
        dp[i - 1][j] + tuning.costInsertDelete,
        dp[i][j - 1] + tuning.costInsertDelete,
        dp[i - 1][j - 1] + substCost
      );
      if (i > 1 && j > 1 &&
          src[i - 1] === tgt[j - 2] &&
          src[i - 2] === tgt[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + tuning.costTransposition);
      }
    }
  }
  return dp[m][n];
}

/**
 * Find best dictionary match for a word.
 * @param {string} word
 * @returns {string | null}
 */
function correctionFind(word) {
  const lower = word.toLowerCase();
  if (dictionary.has(lower)) {
    const dictCasing = dictionaryCasing.get(lower);
    if (dictCasing && dictCasing !== word) return dictCasing;
    return null;
  }

  // check if word is a known stem + allowed suffix
  const cfg = vscode.workspace.getConfiguration('autocorrect');
  const suffixes = cfg.get('suffixesAllow', ['s','es','ed','d','er','est','ing','ly','ment','ness','tion','sion','able','ible','ful','less','ous','ive','al','ial']);
  for (const suffix of suffixes) {
    if (lower.length > suffix.length && lower.endsWith(suffix)) {
      const stem = lower.slice(0, -suffix.length);
      if (stem.length > 1 && dictionary.has(stem)) return null;
      // handle doubling: "stopped" → stem "stopp" → check "stop"
      if (stem.length > 2 && stem[stem.length - 1] === stem[stem.length - 2] && dictionary.has(stem.slice(0, -1))) return null;
      // handle e-drop: "making" (suffix "ing") → stem "mak" → check "make"
      if (stem.length > 1 && dictionary.has(stem + 'e')) return null;
    }
  }

  const tuning = tuningResolve();

  if (lower.length <= tuning.lengthWordMin) return null;

  let bestWord = null;
  let bestDist = Infinity;
  const maxDist = Math.max(tuning.thresholdBase, lower.length * tuning.thresholdScale);

  for (const candidate of dictionaryArray) {
    if (Math.abs(candidate.length - lower.length) > tuning.lengthFilterMax) continue;
    const d = levenshteinWeighted(lower, candidate, tuning);
    const lengthPenalty = Math.abs(candidate.length - lower.length) * tuning.costLengthPenalty;
    const score = d + lengthPenalty;
    if (score < bestDist) {
      bestDist = score;
      bestWord = candidate;
    }
  }

  if (bestDist > maxDist) return null;
  if (bestWord === lower) return null;

  return bestWord;
}

/**
 * Apply casing: dictionary casing first, then infer from typed word.
 * @param {string} original
 * @param {string} replacement
 * @returns {string}
 */
function casingMatch(original, replacement) {
  const dictCasing = dictionaryCasing.get(replacement.toLowerCase());
  if (dictCasing) return dictCasing;

  if (original === original.toUpperCase() && original.length > 1) {
    return replacement.toUpperCase();
  }
  if (original[0] === original[0].toUpperCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

/**
 * Resolve VS Code-style variables in a path string.
 * @param {string} p
 * @returns {string}
 */
function pathResolveVariables(p) {
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

  return resolved;
}

/**
 * Load dictionary from built-in list + any configured file paths.
 */
function dictionaryLoad() {
  dictionary.clear();
  dictionaryCasing.clear();
  for (const w of DICTIONARY_BUILTIN) {
    dictionary.add(w.toLowerCase());
  }

  const config = vscode.workspace.getConfiguration('autocorrect');
  const paths = config.get('dictionaryPaths', []);

  for (const p of paths) {
    try {
      let resolved = pathResolveVariables(p);

      if (!path.isAbsolute(resolved)) {
        const folders = vscode.workspace.workspaceFolders;
        if (folders && folders.length > 0) {
          resolved = path.join(folders[0].uri.fsPath, resolved);
        }
      }

      const filePaths = [];
      if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
        const entries = fs.readdirSync(resolved);
        for (const entry of entries) {
          const full = path.join(resolved, entry);
          if (fs.statSync(full).isFile()) filePaths.push(full);
        }
      } else {
        filePaths.push(resolved);
      }

      for (const fp of filePaths) {
        const text = fs.readFileSync(fp, 'utf8');
        const lines = text.split('\n').map(l => {
          let w = l.replace(/\r$/, '').trim();
          const sep = w.indexOf('::');
          if (sep !== -1) w = w.substring(0, sep).trim();
          return w;
        });
        for (const w of lines) {
          if (w.length === 0 || w.includes(' ')) continue;
          const lower = w.toLowerCase();
          dictionary.add(lower);
          if (w !== lower) dictionaryCasing.set(lower, w);
        }
      }
    } catch (e) {
      vscode.window.showWarningMessage(`Autocorrect: failed to load dictionary "${p}": ${e.message}`);
    }
  }

  dictionaryArray = Array.from(dictionary);
}

/** @type {vscode.FileSystemWatcher[]} */
let dictionaryWatchers = [];

function dictionaryPathsResolve() {
  const config = vscode.workspace.getConfiguration('autocorrect');
  const paths = config.get('dictionaryPaths', []);
  const resolved = [];
  for (const p of paths) {
    let r = pathResolveVariables(p);
    if (!path.isAbsolute(r)) {
      const folders = vscode.workspace.workspaceFolders;
      if (folders && folders.length > 0) {
        r = path.join(folders[0].uri.fsPath, r);
      }
    }
    resolved.push(r);
  }
  return resolved;
}

function dictionaryWatchersCreate(context) {
  for (const w of dictionaryWatchers) w.dispose();
  dictionaryWatchers = [];

  const paths = dictionaryPathsResolve();
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
    watcher.onDidChange(() => dictionaryLoad());
    watcher.onDidCreate(() => dictionaryLoad());
    watcher.onDidDelete(() => dictionaryLoad());
    dictionaryWatchers.push(watcher);
    context.subscriptions.push(watcher);
  }
}

/**
 * Determine if the next character should be auto-capitalized.
 * Quotes (" ') are treated as transparent when checking context.
 * @param {string} textBefore - text on the line before the inserted character
 * @returns {boolean}
 */
function shouldCapitalize(textBefore) {
  // strip transparent quotes from the end to see through them
  const stripped = textBefore.replace(/["']+$/, '');

  // rule 1: start of line / document (empty or whitespace only)
  if (/^\s*$/.test(textBefore)) return true;

  // rule 2: opening quote(s) at line start with optional whitespace
  if (/^\s*["']+\s*$/.test(textBefore)) return true;

  // rule 3: sentence-end punctuation + space(s), looking through quotes
  // e.g. "word. " or "word. "" or "word." "
  if (/[.!?:]\s+$/.test(stripped)) return true;

  // rule 4: sentence-end punctuation + space + opening quote(s) + optional space
  // e.g. 'done. "' — stripped already removed the quote, check if stripped ends with punct+space
  if (/[.!?:]\s*$/.test(stripped) && stripped !== textBefore) return true;

  return false;
}

function activate(context) {
  const config = vscode.workspace.getConfiguration('autocorrect');

  keyCoordMapBuild(config.get('keyboardLayout', ''));
  dictionaryLoad();
  dictionaryWatchersCreate(context);
  prediction.corpusLoad();
  prediction.corpusWatchersCreate(context);
  prediction.predictionProviderRegister(context);

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('autocorrect')) {
        const cfg = vscode.workspace.getConfiguration('autocorrect');
        keyCoordMapBuild(cfg.get('keyboardLayout', ''));
        dictionaryLoad();
        dictionaryWatchersCreate(context);
        prediction.corpusLoad();
        prediction.corpusWatchersCreate(context);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('autocorrect.toggle', () => {
      const cfg = vscode.workspace.getConfiguration('autocorrect');
      const current = cfg.get('enabled', true);
      cfg.update('enabled', !current, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(`Autocorrect ${!current ? 'enabled' : 'disabled'}`);
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(event => {
      if (correcting) return;

      const cfg = vscode.workspace.getConfiguration('autocorrect');
      if (!cfg.get('enabled', true)) return;

      const doc = event.document;
      const languageIds = cfg.get('languageIds', ['jav', 'markdown', 'plaintext']);
      if (!languageIds.includes(doc.languageId)) return;

      for (const change of event.contentChanges) {
        const inserted = change.text;
        const pos = change.range.start;
        const line = doc.lineAt(pos.line).text;
        const textBefore = line.substring(0, pos.character);

        // triple-space → ", " (undoes double-space period, replaces with comma)
        if (cfg.get('triplespaceComma', true) && inserted === ' ' && textBefore.endsWith('. ')) {
          // check that the period was likely from double-space (letter before ". ")
          const beforePeriod = textBefore.slice(0, -2);
          if (beforePeriod.length > 0 && /[a-zA-Z0-9]$/.test(beforePeriod)) {
            const replaceStart = pos.character - 2; // the ". "
            const replaceEnd = pos.character + 1;   // after the third space just inserted
            const range = new vscode.Range(
              new vscode.Position(pos.line, replaceStart),
              new vscode.Position(pos.line, replaceEnd)
            );
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document.uri.toString() === doc.uri.toString()) {
              correcting = true;
              editor.edit(eb => {
                eb.replace(range, ', ');
              }, { undoStopBefore: true, undoStopAfter: true }).then(() => {
                correcting = false;
              }, () => {
                correcting = false;
              });
            }
            continue;
          }
        }

        // double-space → ". "
        if (cfg.get('doublespacePeriod', true) && inserted === ' ' && textBefore.endsWith(' ')) {
          // don't convert if already after punctuation or at line start
          const beforeSpace = textBefore.slice(0, -1);
          if (beforeSpace.length > 0 && /[a-zA-Z0-9]$/.test(beforeSpace)) {
            const replaceStart = pos.character - 1; // the first space
            const replaceEnd = pos.character + 1;   // after the second space just inserted
            const range = new vscode.Range(
              new vscode.Position(pos.line, replaceStart),
              new vscode.Position(pos.line, replaceEnd)
            );
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document.uri.toString() === doc.uri.toString()) {
              correcting = true;
              editor.edit(eb => {
                eb.replace(range, '. ');
              }, { undoStopBefore: true, undoStopAfter: true }).then(() => {
                correcting = false;
              }, () => {
                correcting = false;
              });
            }
            continue;
          }
        }

        // auto-capitalize: first letter of a new sentence
        if (cfg.get('capitalizeSentence', true) && /^[a-z]$/.test(inserted)) {
          if (shouldCapitalize(textBefore)) {
            const charRange = new vscode.Range(
              new vscode.Position(pos.line, pos.character),
              new vscode.Position(pos.line, pos.character + 1)
            );
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document.uri.toString() === doc.uri.toString()) {
              correcting = true;
              editor.edit(eb => {
                eb.replace(charRange, inserted.toUpperCase());
              }, { undoStopBefore: true, undoStopAfter: true }).then(() => {
                correcting = false;
              }, () => {
                correcting = false;
              });
            }
            continue;
          }
        }

        if (!/^[\s.,;:!?()\[\]{}"'\n\r]$/.test(inserted)) continue;

        const wordMatch = textBefore.match(/([a-zA-Z]+)$/);
        if (!wordMatch) continue;

        const typedWord = wordMatch[1];
        const wordStart = pos.character - typedWord.length;

        const correction = correctionFind(typedWord);
        if (!correction) continue;

        const cased = casingMatch(typedWord, correction);

        const range = new vscode.Range(
          new vscode.Position(pos.line, wordStart),
          new vscode.Position(pos.line, pos.character)
        );

        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.uri.toString() !== doc.uri.toString()) continue;

        correcting = true;
        editor.edit(editBuilder => {
          editBuilder.replace(range, cased);
        }, { undoStopBefore: true, undoStopAfter: true }).then(() => {
          correcting = false;
        }, () => {
          correcting = false;
        });
      }
    })
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
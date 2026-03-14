const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { collectGlossaryFiles } = require('./glossaryUtils');

class GlossarySearchViewProvider {
  static viewType = 'javProjectGlossary.glossarySearchView';

  constructor(context) {
    this._context = context;
    this._view = null;
    this._allItems = null;
    this._editorPathCurrent = '';
    this._editorPathsOpen = [];
    this._lastActiveEditor = vscode.window.activeTextEditor || null;

    // Track last active text editor continuously and push updated context to view
    context.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) {
          this._lastActiveEditor = editor;
          this._pushEditorContext();
        }
      })
    );
  }

  get view() { return this._view; }

  focusSearchInput() {
    if (this._view) {
      this._view.show(true);
      this._view.webview.postMessage({ type: 'focusSearch' });
    }
  }

  reveal() {
    if (this._view) {
      this._view.show(true);
      this._view.webview.postMessage({ type: 'focusSearch' });
    } else {
      vscode.commands.executeCommand('javProjectGlossary.glossarySearchView.focus');
    }
  }

  _pushEditorContext() {
    if (!this._view || !this._view.visible) return;

    const lastActiveEditor = this._lastActiveEditor;
    const editorTextCurrent = lastActiveEditor
      ? lastActiveEditor.document.getText()
      : '';
    const editorTextsOpen = vscode.window.visibleTextEditors.map(e => e.document.getText());

    this._editorPathCurrent = lastActiveEditor
      ? lastActiveEditor.document.uri.fsPath
      : '';
    this._editorPathsOpen = vscode.window.visibleTextEditors
      .map(e => e.document.uri.fsPath)
      .filter(p => p);

    this._view.webview.postMessage({
      type: 'editorContext',
      editorTextCurrent,
      editorTextsOpen
    });
  }

  resolveWebviewView(webviewView, _context, _token) {
    this._view = webviewView;
    webviewView.webview.options = { enableScripts: true };

    this._updateWebview();

    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this._updateWebview();
      }
    });

    webviewView.onDidDispose(() => {
      this._view = null;
    });

    webviewView.webview.onDidReceiveMessage(
      message => this._handleMessage(message),
      undefined,
      this._context.subscriptions
    );
  }

  _updateWebview() {
    if (!this._view) return;

    const config = vscode.workspace.getConfiguration('javProjectGlossary');
    const inputFiles = config.get('inputFiles');

    if (!inputFiles?.length) {
      this._view.webview.html = this._getEmptyHtml('No glossary files configured.');
      return;
    }

    const normalizedInputFiles = inputFiles.map(p => path.normalize(p));
    const glossaryFiles = collectGlossaryFiles(normalizedInputFiles);

    if (!glossaryFiles.length) {
      this._view.webview.html = this._getEmptyHtml('No glossary files found.');
      return;
    }

    const lastActiveEditor = this._lastActiveEditor;
    const editorTextCurrent = lastActiveEditor
      ? lastActiveEditor.document.getText()
      : '';
    const editorTextsOpen = vscode.window.visibleTextEditors.map(e => e.document.getText());

    this._editorPathCurrent = lastActiveEditor
      ? lastActiveEditor.document.uri.fsPath
      : '';
    this._editorPathsOpen = vscode.window.visibleTextEditors
      .map(e => e.document.uri.fsPath)
      .filter(p => p);

    const allItems = [];

    for (const filePath of glossaryFiles) {
      const normalizedPath = path.normalize(filePath);
      if (!fs.existsSync(normalizedPath)) continue;

      try {
        const lines = fs.readFileSync(normalizedPath, 'utf8').split(/\r?\n/);

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (!line.trim()) continue;

          const [bodyRaw, description] = line.split(/:(.+)/);
          const term = bodyRaw.trim();
          const desc = (description || '').trim();

          allItems.push({
            term,
            desc,
            file: path.basename(normalizedPath),
            filePath: normalizedPath,
            lineNumber: i
          });
        }
      } catch (err) {
        console.error('[glossarySearch] Error reading file:', normalizedPath, err.message);
      }
    }

    if (!allItems.length) {
      this._view.webview.html = this._getEmptyHtml('No glossary terms found.');
      return;
    }

    this._allItems = allItems;

    const editorFontSize = vscode.workspace.getConfiguration('editor').get('fontSize', 14);
    const editorFontFamily = vscode.workspace.getConfiguration('editor').get('fontFamily', 'monospace');
    this._view.webview.html = getWebviewContent(allItems, editorTextCurrent, editorTextsOpen, editorFontSize, editorFontFamily);
  }

  _handleMessage(message) {
    const allItems = this._allItems;
    if (!allItems) return;

    const item = allItems[message.index];

    if (message.type === 'insertAtCursor') {
      const editor = this._lastActiveEditor;
      if (editor) {
        vscode.window.showTextDocument(editor.document, editor.viewColumn).then(ed => {
          ed.edit(editBuilder => {
            editBuilder.insert(ed.selection.active, item.term);
          });
        });
      }
    } else if (message.type === 'goToDefinition') {
      const viewColumn = this._lastActiveEditor?.viewColumn || vscode.ViewColumn.One;
      const uri = vscode.Uri.file(item.filePath);
      const range = new vscode.Range(item.lineNumber, 0, item.lineNumber, 0);
      vscode.window.showTextDocument(uri, { viewColumn, selection: range });
    } else if (message.type === 'close') {
      if (this._lastActiveEditor) {
        vscode.window.showTextDocument(this._lastActiveEditor.document, this._lastActiveEditor.viewColumn);
      }
    } else if (message.type === 'findInFiles') {
      const term = item.term;
      const searchMode = message.mode || 'all';
      const wf = vscode.workspace.workspaceFolders;
      const root = wf?.length ? path.normalize(wf[0].uri.fsPath) : '';
      const toRel = (absPath) => root ? path.relative(root, absPath).replace(/\\/g, '/') : absPath;

      let filesToInclude = '';

      if (searchMode === 'current' && this._editorPathCurrent) {
        filesToInclude = toRel(this._editorPathCurrent);
      } else if (searchMode === 'open' && this._editorPathsOpen.length) {
        filesToInclude = this._editorPathsOpen.map(toRel).join(', ');
      } else {
        filesToInclude = toRel(path.dirname(item.filePath)) + '/**/*';
      }

      vscode.commands.executeCommand('search.action.openNewEditorToSide', {
        query: term,
        triggerSearch: true,
        isRegex: false,
        isCaseSensitive: false,
        filesToInclude
      });
    }
  }

  _getEmptyHtml(msg) {
    return `<!DOCTYPE html><html><body style="padding:16px;color:var(--vscode-editor-foreground);">${msg}</body></html>`;
  }
}

function getWebviewContent(items, editorTextCurrent, editorTextsOpen, editorFontSize, editorFontFamily) {
  const itemsJson = JSON.stringify(items);
  const editorTextCurrentJson = JSON.stringify(editorTextCurrent);
  const editorTextsOpenJson = JSON.stringify(editorTextsOpen);

  return `<!DOCTYPE html>
<html>
<head>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: ${editorFontFamily};
      font-size: ${editorFontSize}px !important;
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      padding: 8px;
    }
    .search-row {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 8px;
    }
    #search {
      flex: 1;
      padding: 8px;
      font-size: inherit;
      font-family: inherit;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, transparent);
      outline: none;
    }
    #search:focus {
      border-color: var(--vscode-focusBorder);
    }
    #modeIndicator {
      font-size: 0.85em;
      opacity: 0.7;
      white-space: nowrap;
      min-width: 0;
    }
    #results {
      max-height: calc(100vh - 80px);
      overflow-y: auto;
      outline: none;
    }
    .item {
      padding: 6px 8px;
      cursor: pointer;
      display: flex;
      flex-direction: column;
    }
    .item:hover, .item.selected {
      background: var(--vscode-list-hoverBackground);
    }
    .item.selected {
      background: var(--vscode-list-activeSelectionBackground);
      color: var(--vscode-list-activeSelectionForeground);
    }
    .term { font-weight: 500; }
    .desc {
      opacity: 0.7;
      font-size: 0.9em;
      margin-top: 2px;
    }
    .highlight {
      background: var(--vscode-editor-findMatchHighlightBackground, #ea5c0055);
      border-radius: 2px;
    }
    .hint {
      opacity: 0.5;
      font-size: 0.85em;
      padding: 4px 8px;
      border-top: 1px solid var(--vscode-widget-border, #454545);
      margin-top: 8px;
    }
  </style>
</head>
<body>
  <div class="search-row">
    <input type="text" id="search" placeholder="Search glossary · @ current file · @@ open editors" autofocus />
    <span id="modeIndicator"></span>
  </div>
  <div id="results" tabindex="0"></div>
  <div class="hint">Enter Insert · Ctrl+Enter Definition · Alt+Enter Find in files · F2 Search · Esc Editor</div>

  <script>
    const vscode = acquireVsCodeApi();
    const items = ${itemsJson};
    let editorTextCurrent = ${editorTextCurrentJson};
    let editorTextsOpen = ${editorTextsOpenJson};
    let filtered = items.map((item, i) => ({ ...item, originalIndex: i }));
    let selectedIdx = 0;

    const searchEl = document.getElementById('search');
    const resultsEl = document.getElementById('results');
    const modeIndicatorEl = document.getElementById('modeIndicator');

    function termsInText(text) {
      const lower = text.toLowerCase();
      const set = new Set();
      for (const item of items) {
        const termLower = item.term.toLowerCase();
        const escaped = termLower.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&');
        const re = new RegExp('\\\\b' + escaped + '\\\\b', 'i');
        if (re.test(lower)) set.add(termLower);
      }
      return set;
    }

    let termSetCurrent = null;
    let termSetOpen = null;

    function getTermSetCurrent() {
      if (!termSetCurrent) termSetCurrent = termsInText(editorTextCurrent);
      return termSetCurrent;
    }
    function getTermSetOpen() {
      if (!termSetOpen) {
        termSetOpen = new Set();
        for (const t of editorTextsOpen) {
          for (const term of termsInText(t)) termSetOpen.add(term);
        }
      }
      return termSetOpen;
    }

    function parseQuery(raw) {
      if (raw.startsWith('@@')) return { mode: 'open', query: raw.slice(2).trim() };
      if (raw.startsWith('@')) return { mode: 'current', query: raw.slice(1).trim() };
      return { mode: 'all', query: raw.trim() };
    }

    function levenshtein(a, b) {
      if (a.length === 0) return b.length;
      if (b.length === 0) return a.length;
      const matrix = [];
      for (let i = 0; i <= b.length; i++) matrix[i] = [i];
      for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
      for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
          const cost = a[j - 1] === b[i - 1] ? 0 : 1;
          matrix[i][j] = Math.min(
            matrix[i - 1][j] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j - 1] + cost
          );
        }
      }
      return matrix[b.length][a.length];
    }

    function fuzzyWordMatch(query, targetWords) {
      for (const word of targetWords) {
        if (word.startsWith(query)) return { match: true, score: 0 };
        if (word.includes(query)) return { match: true, score: 1 };
        const maxDist = query.length >= 6 ? 2 : query.length >= 4 ? 1 : 0;
        if (maxDist > 0 && Math.abs(word.length - query.length) <= maxDist) {
          const dist = levenshtein(query, word);
          if (dist <= maxDist) return { match: true, score: 2 + dist };
        }
      }
      return { match: false, score: Infinity };
    }

    function scoreItem(queryWords, item) {
      const text = (item.term + ' ' + item.desc).toLowerCase();
      const targetWords = text.split(/\\s+/);
      let total = 0;
      for (const qw of queryWords) {
        const result = fuzzyWordMatch(qw, targetWords);
        if (!result.match) return Infinity;
        total += result.score;
      }
      return total;
    }

    function highlightText(text, queryWords) {
      if (!queryWords.length) return escapeHtml(text);
      const lowerText = text.toLowerCase();

      const matches = [];
      for (const qw of queryWords) {
        let idx = 0;
        while ((idx = lowerText.indexOf(qw, idx)) !== -1) {
          matches.push({ start: idx, end: idx + qw.length });
          idx++;
        }
      }

      if (!matches.length) return escapeHtml(text);

      matches.sort((a, b) => a.start - b.start);
      const merged = [matches[0]];
      for (let i = 1; i < matches.length; i++) {
        const last = merged[merged.length - 1];
        if (matches[i].start <= last.end) {
          last.end = Math.max(last.end, matches[i].end);
        } else {
          merged.push(matches[i]);
        }
      }

      let out = '';
      let pos = 0;
      for (const m of merged) {
        out += escapeHtml(text.slice(pos, m.start));
        out += '<span class="highlight">' + escapeHtml(text.slice(m.start, m.end)) + '</span>';
        pos = m.end;
      }
      out += escapeHtml(text.slice(pos));
      return out;
    }

    function escapeHtml(str) {
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function render() {
      const raw = searchEl.value.toLowerCase();
      const { mode, query } = parseQuery(raw);
      const queryWords = query ? query.split(/\\s+/).filter(Boolean) : [];

      if (mode === 'current') {
        modeIndicatorEl.textContent = 'current file';
      } else if (mode === 'open') {
        modeIndicatorEl.textContent = 'open editors';
      } else {
        modeIndicatorEl.textContent = '';
      }

      let pool = items.map((item, i) => ({ ...item, originalIndex: i }));

      if (mode === 'current') {
        const termSet = getTermSetCurrent();
        pool = pool.filter(item => termSet.has(item.term.toLowerCase()));
      } else if (mode === 'open') {
        const termSet = getTermSetOpen();
        pool = pool.filter(item => termSet.has(item.term.toLowerCase()));
      }

      if (!query) {
        filtered = pool.map(item => ({ ...item, score: 0 }));
      } else {
        filtered = pool
          .map(item => ({ ...item, score: scoreItem(queryWords, item) }))
          .filter(x => x.score < Infinity)
          .sort((a, b) => a.score - b.score);
      }

      selectedIdx = Math.min(selectedIdx, Math.max(0, filtered.length - 1));

      resultsEl.innerHTML = filtered.slice(0, 100).map((item, i) => {
        const sel = i === selectedIdx ? 'selected' : '';
        return \`<div class="item \${sel}" data-idx="\${i}">
          <span class="term">\${highlightText(item.term, queryWords)}</span>
          \${item.desc ? \`<span class="desc">\${highlightText(item.desc, queryWords)}</span>\` : ''}
        </div>\`;
      }).join('');

      const selEl = resultsEl.querySelector('.selected');
      if (selEl) selEl.scrollIntoView({ block: 'nearest' });
    }

    searchEl.addEventListener('input', () => {
      selectedIdx = 0;
      render();
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        vscode.postMessage({ type: 'close' });
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (filtered.length > 0) {
          vscode.postMessage({ type: 'goToDefinition', index: filtered[selectedIdx].originalIndex });
        }
      } else if (e.key === 'Enter' && e.altKey) {
        e.preventDefault();
        if (filtered.length > 0) {
          const raw = searchEl.value.toLowerCase();
          const { mode } = parseQuery(raw);
          vscode.postMessage({ type: 'findInFiles', index: filtered[selectedIdx].originalIndex, mode });
        }
      } else if (e.key === 'Enter') {
        if (filtered.length > 0) {
          vscode.postMessage({ type: 'insertAtCursor', index: filtered[selectedIdx].originalIndex });
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedIdx = Math.min(selectedIdx + 1, filtered.length - 1);
        render();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedIdx = Math.max(selectedIdx - 1, 0);
        render();
      }
    });

    resultsEl.addEventListener('click', e => {
      const item = e.target.closest('.item');
      if (item) {
        const idx = parseInt(item.dataset.idx, 10);
        vscode.postMessage({ type: 'insertAtCursor', index: filtered[idx].originalIndex });
      }
    });

    render();
    searchEl.focus();

    window.addEventListener('message', e => {
      if (e.data && e.data.type === 'focusSearch') {
        searchEl.focus();
        searchEl.select();
      } else if (e.data && e.data.type === 'editorContext') {
        editorTextCurrent = e.data.editorTextCurrent;
        editorTextsOpen = e.data.editorTextsOpen;
        termSetCurrent = null;
        termSetOpen = null;
        render();
      }
    });

    searchEl.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        searchEl.blur();
        resultsEl.focus();
      }
    });

    const targetFontSize = '${editorFontSize}px';
    const targetFontFamily = ${JSON.stringify(editorFontFamily)};
    function applyFont() {
      if (document.body.style.getPropertyValue('font-size') !== targetFontSize ||
          document.body.style.getPropertyValue('font-family') !== targetFontFamily) {
        document.body.style.setProperty('font-size', targetFontSize, 'important');
        document.body.style.setProperty('font-family', targetFontFamily, 'important');
      }
    }
    applyFont();
    new MutationObserver(applyFont).observe(document.body, { attributes: true, attributeFilter: ['style'] });
  </script>
</body>
</html>`;
}

module.exports = { GlossarySearchViewProvider };
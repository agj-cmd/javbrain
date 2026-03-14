const vscode = require('vscode');

// ── Flatten symbols ─────────────────────────────────────────────────────

function flattenSymbols(symbols, depth = 0, parentId = '') {
  const items = [];
  for (let i = 0; i < symbols.length; i++) {
    const s = symbols[i];
    const id = parentId ? `${parentId}-${i}` : `${i}`;
    items.push({
      id,
      parentId: parentId || null,
      name: s.name,
      detail: s.detail || '',
      depth,
      range: {
        startLine: s.range.start.line,
        startChar: s.range.start.character,
        endLine: s.range.end.line,
        endChar: s.range.end.character,
      },
      selectionRange: {
        startLine: s.selectionRange.start.line,
        startChar: s.selectionRange.start.character,
        endLine: s.selectionRange.end.line,
        endChar: s.selectionRange.end.character,
      },
      hasChildren: s.children && s.children.length > 0,
    });
    if (s.children && s.children.length > 0) {
      items.push(...flattenSymbols(s.children, depth + 1, id));
    }
  }
  return items;
}

// ── Webview HTML ────────────────────────────────────────────────────────

function getWebviewHtml() {
  return /*html*/ `<!DOCTYPE html>
<html><head><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: var(--vscode-font-family, sans-serif);
    font-size: 14px;
    color: var(--vscode-foreground);
    background: transparent;
    outline: none;
  }
  #list { outline: none; }
  .item {
    padding: 2px 8px 2px 0;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 22px;
    border: 1px solid transparent;
    display: flex;
    align-items: center;
  }
  .item.active {
    background: var(--vscode-list-activeSelectionBackground);
    color: var(--vscode-list-activeSelectionForeground);
  }
  .item.active .detail {
    color: var(--vscode-list-activeSelectionForeground);
    opacity: 0.7;
  }
  .item.cursor-here:not(.active) {
    border-left: 2px solid var(--vscode-focusBorder, #007fd4);
    background: var(--vscode-list-activeSelectionBackground);
    color: var(--vscode-list-activeSelectionForeground);
  }
  .item.cursor-here:not(.active) .detail {
    color: var(--vscode-list-activeSelectionForeground);
    opacity: 0.7;
  }
  .item:not(.active):not(.cursor-here):hover {
    background: var(--vscode-list-hoverBackground);
  }
  .chevron {
    display: inline-flex;
    width: 16px;
    min-width: 16px;
    justify-content: center;
    font-size: 10px;
    user-select: none;
    opacity: 0.7;
  }
  .chevron.leaf { visibility: hidden; }
  .name-text { overflow: hidden; text-overflow: ellipsis; }
  .detail {
    opacity: 0.6;
    margin-left: 6px;
    font-size: 0.9em;
    flex-shrink: 0;
  }
  #empty {
    padding: 12px;
    opacity: 0.6;
    font-style: italic;
  }
</style></head>
<body tabindex="0">
<div id="list" tabindex="0"></div>
<div id="empty">No symbols</div>
<script>
  const vscode = acquireVsCodeApi();
  const listEl = document.getElementById('list');
  const emptyEl = document.getElementById('empty');

  let allItems = [];
  let collapsed = {};
  let activeIndex = -1;
  let cursorIndex = -1;
  let visible = [];
  let isFocused = false;

  // ── Track focus state ─────────────────────────────────────────

  window.addEventListener('focus', () => {
    isFocused = true;
    if (cursorIndex >= 0) {
      activeIndex = cursorIndex;
    }
    render();
    const el = listEl.querySelector('.item.active');
    if (el) el.scrollIntoView({ block: 'nearest' });
    if (activeIndex >= 0) {
      vscode.postMessage({ type: 'peek', item: visible[activeIndex] });
    }
  });
  window.addEventListener('blur', () => {
    isFocused = false;
    activeIndex = -1;
    render();
  });

  // ── Compute visible ───────────────────────────────────────────

  function computeVisible() {
    visible = [];
    const collapsedAncestors = new Set();
    for (const item of allItems) {
      if (item.parentId && collapsedAncestors.has(item.parentId)) {
        if (item.hasChildren) collapsedAncestors.add(item.id);
        continue;
      }
      visible.push(item);
      if (item.hasChildren && collapsed[item.id]) {
        collapsedAncestors.add(item.id);
      }
    }
  }

  // ── Find visible index for a given editor line ────────────────

  function findIndexForLine(line) {
    let best = -1;
    for (let i = visible.length - 1; i >= 0; i--) {
      const r = visible[i].range;
      if (line >= r.startLine && line <= r.endLine) {
        if (best === -1 || visible[i].depth > visible[best].depth) {
          best = i;
        }
      }
    }
    if (best >= 0) return best;
    let closestDist = Infinity;
    let closestIdx = 0;
    for (let i = 0; i < visible.length; i++) {
      const d = Math.abs(visible[i].selectionRange.startLine - line);
      if (d < closestDist) { closestDist = d; closestIdx = i; }
    }
    return closestIdx;
  }

  // ── Render ────────────────────────────────────────────────────

  function render() {
    computeVisible();
    if (visible.length === 0) {
      listEl.style.display = 'none';
      emptyEl.style.display = 'block';
      return;
    }
    emptyEl.style.display = 'none';
    listEl.style.display = 'block';

    if (activeIndex >= visible.length) activeIndex = visible.length - 1;

    listEl.innerHTML = visible.map((item, i) => {
      const indent = item.depth * 16 + 4;
      let cls = 'item';
      // Only show active highlight when focused
      if (i === activeIndex && isFocused) cls += ' active';
      if (i === cursorIndex && !(i === activeIndex && isFocused)) cls += ' cursor-here';
      const isCollapsed = collapsed[item.id];
      let chevron;
      if (item.hasChildren) {
        chevron = '<span class="chevron" data-toggle="' + item.id + '">' + (isCollapsed ? '&#9654;' : '&#9660;') + '</span>';
      } else {
        chevron = '<span class="chevron leaf"></span>';
      }
      const detail = item.detail ? '<span class="detail">' + esc(item.detail) + '</span>' : '';
      return '<div class="' + cls + '" data-index="' + i + '" style="padding-left:' + indent + 'px">'
        + chevron + '<span class="name-text">' + esc(item.name) + '</span>' + detail + '</div>';
    }).join('');
  }

  function esc(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ── Set active + peek ─────────────────────────────────────────

  function setActive(index) {
    if (index < 0 || index >= visible.length) return;
    activeIndex = index;
    render();
    const el = listEl.querySelector('.item.active');
    if (el) el.scrollIntoView({ block: 'nearest' });
    vscode.postMessage({ type: 'peek', item: visible[index] });
  }

  // ── Collapse helpers ──────────────────────────────────────────

  function notifyFold(item, isFolded) {
    vscode.postMessage({ type: isFolded ? 'editorFold' : 'editorUnfold', line: item.range.startLine });
  }

  function collapseAll() {
    for (const item of allItems) {
      if (item.hasChildren && !collapsed[item.id]) {
        collapsed[item.id] = true;
        notifyFold(item, true);
      }
    }
    render();
  }

  function expandAll() {
    for (const item of allItems) {
      if (item.hasChildren && collapsed[item.id]) {
        notifyFold(item, false);
      }
    }
    collapsed = {};
    render();
  }

  // ── Keyboard ──────────────────────────────────────────────────

  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault(); expandAll(); return;
    }
    if (e.key === 'ArrowLeft' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault(); collapseAll(); return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (activeIndex < visible.length - 1) setActive(activeIndex + 1);
      else if (activeIndex === -1 && visible.length > 0) setActive(0);

    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (activeIndex > 0) setActive(activeIndex - 1);

    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (activeIndex >= 0) {
        const item = visible[activeIndex];
        if (item.hasChildren && collapsed[item.id]) {
          delete collapsed[item.id];
          notifyFold(item, false);
          render();
        } else if (item.hasChildren) {
          setActive(activeIndex + 1);
        }
      }

    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (activeIndex >= 0) {
        const item = visible[activeIndex];
        if (item.hasChildren && !collapsed[item.id]) {
          collapsed[item.id] = true;
          notifyFold(item, true);
          render();
        } else if (item.parentId) {
          const parentIdx = visible.findIndex(v => v.id === item.parentId);
          if (parentIdx >= 0) setActive(parentIdx);
        }
      }

    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0) vscode.postMessage({ type: 'confirm', item: visible[activeIndex] });

    } else if (e.key === 'Escape') {
      e.preventDefault();
      vscode.postMessage({ type: 'cancel' });
      activeIndex = -1;
      render();
    }
  });

  // ── Click ─────────────────────────────────────────────────────

  listEl.addEventListener('click', (e) => {
    const chevron = e.target.closest('.chevron[data-toggle]');
    if (chevron) {
      const id = chevron.dataset.toggle;
      const wasFolded = !!collapsed[id];
      collapsed[id] = !collapsed[id];
      if (!collapsed[id]) delete collapsed[id];
      const item = allItems.find(it => it.id === id);
      if (item) notifyFold(item, !wasFolded);
      render();
      return;
    }
    const el = e.target.closest('.item');
    if (!el) return;
    const idx = parseInt(el.dataset.index, 10);
    activeIndex = idx;
    render();
    vscode.postMessage({ type: 'confirm', item: visible[idx] });
  });

  // ── Messages from extension ───────────────────────────────────

  window.addEventListener('message', (e) => {
    const msg = e.data;
    if (msg.type === 'setSymbols') {
      allItems = msg.items;
      activeIndex = -1;
      const validIds = new Set(allItems.map(i => i.id));
      for (const id of Object.keys(collapsed)) {
        if (!validIds.has(id)) delete collapsed[id];
      }
      computeVisible();
      if (typeof msg.cursorLine === 'number' && visible.length > 0) {
        cursorIndex = findIndexForLine(msg.cursorLine);
      }
      render();

    } else if (msg.type === 'cursorMove') {
      computeVisible();
      if (visible.length > 0) {
        cursorIndex = findIndexForLine(msg.line);
        render();
      }

    } else if (msg.type === 'focus') {
      isFocused = true;
      computeVisible();
      if (visible.length > 0 && typeof msg.line === 'number') {
        const idx = findIndexForLine(msg.line);
        cursorIndex = idx;
        activeIndex = idx;
        render();
        const el = listEl.querySelector('.item.active');
        if (el) el.scrollIntoView({ block: 'nearest' });
        vscode.postMessage({ type: 'peek', item: visible[idx] });
      }

    } else if (msg.type === 'setFontSize') {
      document.body.style.fontSize = msg.size + 'px';
    }
  });
</script>
</body></html>`;
}

// ── WebviewView provider ────────────────────────────────────────────────

class OutlinePeekViewProvider {
  constructor(context) {
    this._context = context;
    this._view = undefined;
    this._peekDecoration = vscode.window.createTextEditorDecorationType({
      backgroundColor: new vscode.ThemeColor('editor.rangeHighlightBackground'),
      borderColor: new vscode.ThemeColor('editor.rangeHighlightBorder'),
      borderWidth: '1px',
      borderStyle: 'solid',
      isWholeLine: true,
    });
    this._savedPosition = undefined;
    this._peekActive = false;
  }

  resolveWebviewView(webviewView) {
    this._view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = getWebviewHtml();

    webviewView.webview.onDidReceiveMessage((msg) => {
      if (msg.type === 'peek') this._handlePeek(msg.item);
      else if (msg.type === 'confirm') this._handleConfirm(msg.item);
      else if (msg.type === 'cancel') this._handleCancel();
      else if (msg.type === 'editorFold') this._handleEditorFold(msg.line);
      else if (msg.type === 'editorUnfold') this._handleEditorUnfold(msg.line);
    });

    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) this.refresh();
    });

    this._sendFontSize();
  }

  _sendFontSize() {
    const size = vscode.workspace.getConfiguration('editor').get('fontSize', 14);
    this.postMessage({ type: 'setFontSize', size });
  }

  postMessage(msg) {
    if (this._view) this._view.webview.postMessage(msg);
  }

  sendSymbols(items, cursorLine) {
    this.postMessage({ type: 'setSymbols', items, cursorLine });
  }

  sendCursorMove(line) {
    this.postMessage({ type: 'cursorMove', line });
  }

  sendFocus(line) {
    this.postMessage({ type: 'focus', line });
  }

  refresh() {}

  _handleEditorFold(line) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    vscode.commands.executeCommand('editor.fold', {
      selectionLines: [line],
    });
  }

  _handleEditorUnfold(line) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    vscode.commands.executeCommand('editor.unfold', {
      selectionLines: [line],
    });
  }

  _handlePeek(item) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    if (!this._peekActive) {
      this._savedPosition = {
        uri: editor.document.uri.toString(),
        selection: editor.selection,
        visibleRange: editor.visibleRanges[0],
      };
      this._peekActive = true;
    }
    const range = new vscode.Range(
      item.range.startLine, item.range.startChar,
      item.range.endLine, item.range.endChar
    );
    const selRange = new vscode.Range(
      item.selectionRange.startLine, item.selectionRange.startChar,
      item.selectionRange.endLine, item.selectionRange.endChar
    );
    editor.setDecorations(this._peekDecoration, [range]);
    editor.revealRange(selRange, vscode.TextEditorRevealType.InCenter);
  }

  _handleConfirm(item) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    const pos = new vscode.Position(
      item.selectionRange.startLine,
      item.selectionRange.startChar
    );
    const selRange = new vscode.Range(
      item.selectionRange.startLine, item.selectionRange.startChar,
      item.selectionRange.endLine, item.selectionRange.endChar
    );
    editor.setDecorations(this._peekDecoration, []);
    editor.selection = new vscode.Selection(pos, pos);
    editor.revealRange(selRange, vscode.TextEditorRevealType.InCenter);
    this._savedPosition = undefined;
    this._peekActive = false;
    vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
  }

  _handleCancel() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    editor.setDecorations(this._peekDecoration, []);
    if (this._savedPosition && editor.document.uri.toString() === this._savedPosition.uri) {
      editor.selection = this._savedPosition.selection;
      editor.revealRange(this._savedPosition.visibleRange, vscode.TextEditorRevealType.AtTop);
    }
    this._savedPosition = undefined;
    this._peekActive = false;
    vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
  }

}

// ── Activation ──────────────────────────────────────────────────────────

function activate(context) {
  const viewProvider = new OutlinePeekViewProvider(context);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('outlinePeek.view', viewProvider)
  );

  async function updateSymbols(editor) {
    if (!editor) {
      viewProvider.sendSymbols([], 0);
      return;
    }
    const symbols = await vscode.commands.executeCommand(
      'vscode.executeDocumentSymbolProvider',
      editor.document.uri
    );
    const items = flattenSymbols(symbols || []);
    const cursorLine = editor.selection.active.line;
    viewProvider.sendSymbols(items, cursorLine);
  }

  viewProvider.refresh = () => updateSymbols(vscode.window.activeTextEditor);

  let debounceTimer;

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => updateSymbols(editor))
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      const editor = vscode.window.activeTextEditor;
      if (editor && e.document === editor.document) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => updateSymbols(editor), 500);
      }
    })
  );

  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection((e) => {
      if (e.textEditor === vscode.window.activeTextEditor) {
        viewProvider.sendCursorMove(e.selections[0].active.line);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('outlinePeek.focus', () => {
      const editor = vscode.window.activeTextEditor;
      const line = editor ? editor.selection.active.line : 0;
      vscode.commands.executeCommand('outlinePeek.view.focus').then(() => {
        viewProvider.sendFocus(line);
      });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('outlinePeek.refresh', () => {
      updateSymbols(vscode.window.activeTextEditor);
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('editor.fontSize')) {
        viewProvider._sendFontSize();
      }
    })
  );

  updateSymbols(vscode.window.activeTextEditor);
}

function deactivate() {}

module.exports = { activate, deactivate };
const vscode = require("vscode");

let enabled = false;
let focusMode = false;
let statusBar = null;
let focusStatusBar = null;
let debounceTimer = null;
let scrollTimer = null;
let selectionListener = null;
let focusDecoration = null;

function scrollStep() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return stopScrolling();

  const cursorLine = editor.selection.active.line;
  const ranges = editor.visibleRanges;
  if (!ranges.length) return stopScrolling();

  const topLine = ranges[0].start.line;
  const bottomLine = ranges[ranges.length - 1].end.line;
  const offset = vscode.workspace.getConfiguration("autoscroll").get("centerOffset", 0);
  const centerLine = Math.round((topLine + bottomLine) / 2) + offset;
  const distance = Math.abs(cursorLine - centerLine);

  if (distance === 0) return stopScrolling();

  const lines = Math.min(Math.max(1, Math.ceil(distance / 3)), 30);

  vscode.commands.executeCommand("editorScroll", {
    to: cursorLine < centerLine ? "up" : "down",
    by: "wrappedLine",
    value: lines,
  });
}

function startScrolling() {
  stopScrolling();
  scrollTimer = setInterval(scrollStep, 10);
}

function stopScrolling() {
  if (scrollTimer) {
    clearInterval(scrollTimer);
    scrollTimer = null;
  }
}

function onSelectionChange() {
  if (enabled) {
    stopScrolling();
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(startScrolling, 350);
  }
  if (focusMode) applyFocusDecorations();
}

function applyFocusDecorations() {
  const editor = vscode.window.activeTextEditor;
  if (!editor || !focusDecoration) return;

  const cursorLine = editor.selection.active.line;
  const ranges = [];

  if (cursorLine > 0) {
    ranges.push(new vscode.Range(0, 0, cursorLine - 1, Number.MAX_SAFE_INTEGER));
  }
  if (cursorLine < editor.document.lineCount - 1) {
    ranges.push(new vscode.Range(cursorLine + 1, 0, editor.document.lineCount - 1, Number.MAX_SAFE_INTEGER));
  }

  editor.setDecorations(focusDecoration, ranges);
}

function clearFocusDecorations() {
  const editor = vscode.window.activeTextEditor;
  if (editor && focusDecoration) {
    editor.setDecorations(focusDecoration, []);
  }
}

function startFocus() {
  focusMode = true;
  if (!focusDecoration) {
    focusDecoration = vscode.window.createTextEditorDecorationType({ opacity: "0" });
  }
  applyFocusDecorations();
  ensureSelectionListener();
  updateFocusStatusBar();
}

function stopFocus() {
  focusMode = false;
  clearFocusDecorations();
  if (focusDecoration) {
    focusDecoration.dispose();
    focusDecoration = null;
  }
  if (!enabled) disposeSelectionListener();
  updateFocusStatusBar();
}

function toggleFocus() {
  focusMode ? stopFocus() : startFocus();
}

function ensureSelectionListener() {
  if (!selectionListener) {
    selectionListener = vscode.window.onDidChangeTextEditorSelection(onSelectionChange);
  }
}

function disposeSelectionListener() {
  if (selectionListener) {
    selectionListener.dispose();
    selectionListener = null;
  }
}

function start() {
  stop();
  enabled = true;
  ensureSelectionListener();
  updateStatusBar();
}

function stop() {
  enabled = false;
  stopScrolling();
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (!focusMode) disposeSelectionListener();
  updateStatusBar();
}

function toggle() {
  enabled ? stop() : start();
}

function updateStatusBar() {
  if (statusBar) {
    statusBar.text = enabled ? "$(sync~spin) AutoScroll" : "$(sync) AutoScroll";
    statusBar.tooltip = enabled ? "AutoScroll: ON" : "AutoScroll: OFF";
  }
}

function updateFocusStatusBar() {
  if (focusStatusBar) {
    focusStatusBar.text = focusMode ? "$(eye-closed) Focus" : "$(eye) Focus";
    focusStatusBar.tooltip = focusMode ? "Focus Mode: ON" : "Focus Mode: OFF";
  }
}

function activate(context) {
  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.command = "autoscroll.toggle";
  statusBar.show();

  focusStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
  focusStatusBar.command = "autoscroll.toggleFocus";
  focusStatusBar.show();

  context.subscriptions.push(
    vscode.commands.registerCommand("autoscroll.enable", start),
    vscode.commands.registerCommand("autoscroll.disable", stop),
    vscode.commands.registerCommand("autoscroll.toggle", toggle),
    vscode.commands.registerCommand("autoscroll.enableFocus", startFocus),
    vscode.commands.registerCommand("autoscroll.disableFocus", stopFocus),
    vscode.commands.registerCommand("autoscroll.toggleFocus", toggleFocus),
    statusBar,
    focusStatusBar
  );

  const startOnBoot = vscode.workspace.getConfiguration("autoscroll").get("enabledOnStartup", false);
  if (startOnBoot) start();
  else updateStatusBar();
  updateFocusStatusBar();
}

function deactivate() {
  stop();
  stopFocus();
}

module.exports = { activate, deactivate };
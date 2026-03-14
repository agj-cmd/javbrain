const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

let correctionMap = new Map();
let watcher = null;
let isEnabled = true;
let statusBarItem = null;
let lastCorrectionRange = null;
let decorationType = null;


function loadCorrections(filePath) {
  correctionMap.clear();
  try {
    const lines = fs.readFileSync(filePath, 'utf-8').split(/\r?\n/);
    for (const line of lines) {
      const [wrong, correct] = line.split(/\s*::\s*/);
      if (wrong && correct) correctionMap.set(wrong.toLowerCase(), correct);
    }
  } catch {}
}

function preserveCase(original, corrected) {
  if (/^[A-Z]/.test(corrected)) return corrected;
  if (/^[A-Z]/.test(original)) return corrected[0].toUpperCase() + corrected.slice(1);
  if (/^[A-Z]+$/.test(original)) return corrected.toUpperCase();
  return corrected;
}

function updateStatusBar() {
  if (!statusBarItem) {
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'liveAutoCorrect.toggle';
    statusBarItem.show();
  }
  statusBarItem.text = isEnabled ? '🔤 AutoCorrect On' : '⛔ AutoCorrect Off';
}

function updateSuggestionDecoration(editor) {
  if (!editor) return;

  if (!decorationType) {
    decorationType = vscode.window.createTextEditorDecorationType({
      before: {
        contentText: '',
        border: '1px solid #888',
        backgroundColor: '#2d2d2d',
        color: '#cccccc',
        margin: '0 4em 0 0',
        textDecoration: 'none; position: absolute; bottom: 0; padding: 2px 6px; border-radius: 3px;'
      }
    });
  }

  const pos = editor.selection.active;
  const line = editor.document.lineAt(pos.line);
  const textBefore = line.text.slice(0, pos.character);
  const match = textBefore.match(/([\w']+)$/);

  if (!match) {
    editor.setDecorations(decorationType, []);
    return;
  }

  const prefix = match[1].toLowerCase();
  const matches = [];

  for (const [wrong, correct] of correctionMap) {
    if (wrong.startsWith(prefix)) {
      matches.push(`${wrong}→${correct}`);
    }
  }

  if (matches.length === 0) {
    editor.setDecorations(decorationType, []);
    return;
  }

  const joined = matches.join(' · ');
  const maxChars = 16;
  const lines = [];

  let currentLine = '';
  for (const match of matches) {
    const segment = match + ' · ';
    if ((currentLine + segment).length > maxChars) {
      lines.push(currentLine.slice(0, -3)); // Remove trailing ' · '
      currentLine = segment;
    } else {
      currentLine += segment;
    }
  }
  if (currentLine) {
    lines.push(currentLine.slice(0, -3));
  }

const editorConfig = vscode.workspace.getConfiguration('editor');
  const editorFontSize = editorConfig.get('fontSize', 14);
  const editorLineHeight = editorConfig.get('lineHeight', 0);
  const resolvedLineHeight = editorLineHeight > 0 ? editorLineHeight : Math.round(editorFontSize * 1.5);
  const tooltipFontSize = Math.round(editorFontSize);
  const tooltipLineHeight = tooltipFontSize + 20;
  const baseOffset = resolvedLineHeight + 4;

  const decorations = lines.map((text, i) => ({
    range: new vscode.Range(pos, pos),
    renderOptions: {
      before: {
        contentText: text,
        textDecoration: `none; position: absolute; bottom: ${baseOffset + (i * tooltipLineHeight)}px; padding: 2px 6px; border-radius: 3px; font-size: ${tooltipFontSize}px; line-height: ${tooltipLineHeight}px;`
      }
    }
  }));

  editor.setDecorations(decorationType, decorations);
}

async function maybeCorrect(e) {
  if (!isEnabled) return;
  const doc = e.document;
  if (e.contentChanges.length === 0) return;
  const change = e.contentChanges[0];
  if (!change || !/^[\s\.\,\!\?\)\]]+$/.test(change.text)) return;

  const pos = change.range.end;
  const line = doc.lineAt(pos.line);
  const textBeforeChange = line.text.slice(0, pos.character);

  if (/^\s*$/.test(textBeforeChange)) return;

  const text = textBeforeChange;
  const match = text.match(/([\w']+)[\s\.\,\!\?\)\]]*$/);
  if (!match) return;

  const word = match[1];
  const key = word.toLowerCase();
  if (!correctionMap.has(key)) return;

  const correct = correctionMap.get(key);
  const startCol = pos.character - word.length - 1;
  const start = new vscode.Position(pos.line, startCol + 1);
  const end = new vscode.Position(pos.line, pos.character);
  const range = new vscode.Range(start, end);

  if (doc.getText(range) !== word) return;
  if (lastCorrectionRange && range.isEqual(lastCorrectionRange)) return;

  const edit = new vscode.WorkspaceEdit();
  const fixed = preserveCase(word, correct);
  edit.replace(doc.uri, range, fixed);
  lastCorrectionRange = range;
  await vscode.workspace.applyEdit(edit);
}


async function applyCorrectionsCommand() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const doc = editor.document;
  const selection = editor.selection;
  const range = selection.isEmpty
    ? doc.lineAt(selection.active.line).range
    : new vscode.Range(selection.start, selection.end);

  const text = doc.getText(range);
  const wordPattern = /[\w']+/g;
  let match;
  const edits = [];
  while ((match = wordPattern.exec(text))) {
    const word = match[0];
    const key = word.toLowerCase();
    if (!correctionMap.has(key)) continue;

    const correct = correctionMap.get(key);
    const start = doc.positionAt(doc.offsetAt(range.start) + match.index);
    const end = doc.positionAt(doc.offsetAt(range.start) + match.index + word.length);
    const fixed = preserveCase(word, correct);
    edits.push({ range: new vscode.Range(start, end), text: fixed });
  }

  if (edits.length > 0) {
    const edit = new vscode.WorkspaceEdit();
    for (const e of edits) edit.replace(doc.uri, e.range, e.text);
    await vscode.workspace.applyEdit(edit);
  }
}

function activate(context) {
  const config = vscode.workspace.getConfiguration('liveAutoCorrect');
  const filePath = config.get('correctionFilePath') || path.join(__dirname, 'autocorrect.txt');
  loadCorrections(filePath);
  watcher = fs.watch(filePath, () => loadCorrections(filePath));
  updateStatusBar();

  context.subscriptions.push(
    vscode.commands.registerCommand('liveAutoCorrect.toggle', () => {
      isEnabled = !isEnabled;
      updateStatusBar();
    }),
    vscode.commands.registerCommand('liveAutoCorrect.applyToSelectionOrLine', applyCorrectionsCommand),
    vscode.workspace.onDidChangeTextDocument(maybeCorrect),
    vscode.window.onDidChangeTextEditorSelection(() => {
      updateSuggestionDecoration(vscode.window.activeTextEditor);
    }),
    vscode.workspace.onDidChangeTextDocument(() => {
      updateSuggestionDecoration(vscode.window.activeTextEditor);
    }),
    statusBarItem
  );
}

function deactivate() {
  if (watcher) watcher.close();
}

module.exports = { activate, deactivate };
// src/commands/nextEmptyLine.js
const vscode = require('vscode');

function isEmptyOrMarker(line) {
  return line.trim() === '' || /^\d{4}:\s*$/.test(line);
}

function isMarkerLine(line) {
  return /^\d{4}:\s*$/.test(line);
}

function findNextLogicalBreak(editor, direction) {
  const doc = editor.document;
  const pos = editor.selection.active;
  const startLine = pos.line;
  const lineCount = doc.lineCount;
  const step = direction === 'down' ? 1 : -1;

  // Generate a wrapped line index sequence
  const indices = [];
  if (direction === 'down') {
    for (let i = startLine + 1; i < lineCount; i++) indices.push(i);
    for (let i = 0; i <= startLine; i++) indices.push(i);
  } else {
    for (let i = startLine - 1; i >= 0; i--) indices.push(i);
    for (let i = lineCount - 1; i >= startLine; i--) indices.push(i);
  }

  let seenNonEmpty = false;

  for (const i of indices) {
    const lineText = doc.lineAt(i).text;

    if (!isEmptyOrMarker(lineText)) {
      seenNonEmpty = true;
      continue;
    }

    if (seenNonEmpty && isEmptyOrMarker(lineText)) {
      let col = 0;
      if (isMarkerLine(lineText)) {
        const idx = lineText.indexOf(':');
        if (idx !== -1) col = idx + 1;
      }
      const newPos = new vscode.Position(i, col);
      editor.selection = new vscode.Selection(newPos, newPos);
      editor.revealRange(new vscode.Range(newPos, newPos));
      return;
    }
  }

  vscode.window.showInformationMessage(`No logical break found.`);
}

function nextEmptyLineDown() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;
  findNextLogicalBreak(editor, 'down');
}

function nextEmptyLineUp() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;
  findNextLogicalBreak(editor, 'up');
}

module.exports = { nextEmptyLineDown, nextEmptyLineUp };

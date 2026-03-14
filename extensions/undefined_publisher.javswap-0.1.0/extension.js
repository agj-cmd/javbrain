const vscode = require('vscode');

/** @type {vscode.TextEditorDecorationType | null} */
let decorationType = null;

/** @type {{ text: string, range: vscode.Range, uri: string } | null} */
let markedSelection = null;

function activate(context) {
  decorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: new vscode.ThemeColor('editor.selectionBackground'),
    color: new vscode.ThemeColor('editor.selectionForeground'),
  });
  context.subscriptions.push(decorationType);

  const swapCmd = vscode.commands.registerCommand('javSwap.swap', () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const selection = editor.selection;

    if (!markedSelection) {
      if (selection.isEmpty) {
        vscode.window.showWarningMessage('javSwap: No selection.');
        return;
      }
      const text = editor.document.getText(selection);
      const range = new vscode.Range(selection.start, selection.end);
      markSelection(editor, text, range);
    } else if (selection.isEmpty) {
      executeMoveToPosition(editor, selection.active);
    } else {
      const text = editor.document.getText(selection);
      const range = new vscode.Range(selection.start, selection.end);
      executeSwap(editor, text, range);
    }
  });
  const cancelCmd = vscode.commands.registerCommand('javSwap.swapCancel', () => {
    clearMarked();
    vscode.window.showInformationMessage('javSwap: Cancelled.');
  });

  // Track edits and shift the marked range accordingly.
  const changeListener = vscode.workspace.onDidChangeTextDocument(e => {
    if (!markedSelection) return;
    if (e.document.uri.toString() !== markedSelection.uri) return;

    let { range } = markedSelection;

    for (const change of e.contentChanges) {
      const updated = shiftRange(range, change);
      if (!updated) {
        clearMarked();
        return;
      }
      range = updated;
    }

    markedSelection.range = range;
    markedSelection.text = e.document.getText(range);

    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.uri.toString() === markedSelection.uri) {
      editor.setDecorations(decorationType, [range]);
    }
  });

  context.subscriptions.push(swapCmd, cancelCmd, changeListener);
}

/**
 * @param {vscode.TextEditor} editor
 * @param {string} text
 * @param {vscode.Range} range
 */
function markSelection(editor, text, range) {
  markedSelection = {
    text,
    range,
    uri: editor.document.uri.toString(),
  };
  vscode.commands.executeCommand('setContext', 'javSwap.swapActive', true);
  editor.setDecorations(decorationType, [range]);
}

/**
 * @param {vscode.TextEditor} editor
 * @param {string} textB
 * @param {vscode.Range} rangeB
 */
async function executeSwap(editor, textB, rangeB) {
  let { text: textA, range: rangeA, uri } = markedSelection;

  if (editor.document.uri.toString() !== uri) {
    vscode.window.showWarningMessage('javSwap: Selections must be in the same document.');
    clearMarked();
    return;
  }

  if (rangeA.isEqual(rangeB)) {
    vscode.window.showWarningMessage('javSwap: Same selection. Nothing to swap.');
    clearMarked();
    return;
  }

  if (rangeA.intersection(rangeB)) {
    // Trim overlap: earlier range keeps the overlapping characters.
    const [first, second, firstIsA] = rangeA.start.isBefore(rangeB.start)
      ? [rangeA, rangeB, true]
      : [rangeB, rangeA, false];

    const trimmedSecond = new vscode.Range(first.end, second.end);

    if (trimmedSecond.isEmpty) {
      vscode.window.showWarningMessage('javSwap: Second selection is entirely within the first.');
      clearMarked();
      return;
    }

    const trimmedText = editor.document.getText(trimmedSecond);

    if (firstIsA) {
      rangeB = trimmedSecond;
      textB = trimmedText;
    } else {
      rangeA = trimmedSecond;
      textA = editor.document.getText(trimmedSecond);
    }
  }

  await editor.edit(editBuilder => {
    editBuilder.replace(rangeA, textB);
    editBuilder.replace(rangeB, textA);
  });

  clearMarked();
}

/**
 * Cut marked text and insert at cursor position.
 * @param {vscode.TextEditor} editor
 * @param {vscode.Position} position
 */
async function executeMoveToPosition(editor, position) {
  const { text: textA, range: rangeA, uri } = markedSelection;

  if (editor.document.uri.toString() !== uri) {
    vscode.window.showWarningMessage('javSwap: Must be in the same document.');
    clearMarked();
    return;
  }

  // If cursor is inside the marked range, nothing to do.
  if (rangeA.contains(position)) {
    vscode.window.showWarningMessage('javSwap: Cursor is inside marked selection.');
    clearMarked();
    return;
  }

  await editor.edit(editBuilder => {
    editBuilder.delete(rangeA);
    editBuilder.insert(position, textA);
  });

  clearMarked();
}

function clearMarked() {
  markedSelection = null;
  vscode.commands.executeCommand('setContext', 'javSwap.swapActive', false);
  const editor = vscode.window.activeTextEditor;
  if (editor && decorationType) {
    editor.setDecorations(decorationType, []);
  }
}

/**
 * Shift a range based on a single content change.
 * Returns the adjusted range, or null if the edit overlaps and invalidates it.
 * @param {vscode.Range} range
 * @param {vscode.TextDocumentContentChangeEvent} change
 * @returns {vscode.Range | null}
 */
function shiftRange(range, change) {
  const editStart = change.range.start;
  const editEnd = change.range.end;
  const newText = change.text;

  // Edit is entirely after the range — no shift needed.
  if (editStart.isAfterOrEqual(range.end)) {
    return range;
  }

  // Edit is entirely before the range — shift both endpoints.
  if (editEnd.isBeforeOrEqual(range.start)) {
    const delta = positionDelta(editStart, editEnd, newText);
    return new vscode.Range(
      shiftPosition(range.start, editEnd, delta),
      shiftPosition(range.end, editEnd, delta)
    );
  }

  // Edit overlaps the marked range — invalidate.
  return null;
}

/**
 * Compute the line/character delta caused by replacing editStart..editEnd with newText.
 * @param {vscode.Position} editStart
 * @param {vscode.Position} editEnd
 * @param {string} newText
 * @returns {{ lines: number, chars: number, lastLineLength: number }}
 */
function positionDelta(editStart, editEnd, newText) {
  const newLines = newText.split('\n');
  const addedLines = newLines.length - 1;
  const removedLines = editEnd.line - editStart.line;
  const lastLineLength = newLines[newLines.length - 1].length;

  return { lines: addedLines - removedLines, lastLineLength, addedLines, editStart };
}

/**
 * Shift a position that is at or after editEnd by the computed delta.
 * @param {vscode.Position} pos
 * @param {vscode.Position} editEnd
 * @param {object} delta
 * @returns {vscode.Position}
 */
function shiftPosition(pos, editEnd, delta) {
  if (pos.line === editEnd.line) {
    // Same line as edit end — character offset needs adjustment.
    const charOffset = pos.character - editEnd.character;
    if (delta.addedLines > 0) {
      return new vscode.Position(
        pos.line + delta.lines,
        delta.lastLineLength + charOffset
      );
    } else {
      return new vscode.Position(
        pos.line + delta.lines,
        delta.editStart.character + delta.lastLineLength + charOffset
      );
    }
  }
  // Different line — only line number shifts.
  return new vscode.Position(pos.line + delta.lines, pos.character);
}

function deactivate() {
  clearMarked();
}

module.exports = { activate, deactivate };
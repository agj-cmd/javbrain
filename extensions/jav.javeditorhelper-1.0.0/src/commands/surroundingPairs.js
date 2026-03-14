const vscode = require('vscode');

function getDelimiters() {
  const config = vscode.workspace.getConfiguration('JavEditorHelper');
  return config.get('surroundingPairs') || [
    ['[', ']'],
    ['{', '}'],
    ['(', ')'],
    ["'", "'"],
    ['"', '"'],
    ['*', '*']
  ];
}

function selectSurround() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const delimiters = getDelimiters();
  const doc = editor.document;
  const selections = editor.selections;
  let newSelections = [];

  for (const sel of selections) {
    let newSel = null;

    if (!sel.isEmpty) {
      const line = doc.lineAt(sel.start.line).text;
      let isExpanded = false;

      for (const [open, close] of delimiters) {
        const selText = doc.getText(sel);
        if (selText.startsWith(open) && selText.endsWith(close) && selText.length > open.length + close.length) {
          isExpanded = true;
          break;
        }
      }

      if (isExpanded) {
        // Jump to next pair content
        const startLine = sel.end.line;
        const startChar = sel.end.character;
        let selectedPair = findNextPair(doc, delimiters, startLine, startChar);

        // Wrap to beginning if none found
        if (!selectedPair) {
          selectedPair = findNextPair(doc, delimiters, 0, 0, startLine);
        }

        if (selectedPair) {
          newSel = pairToSelection(selectedPair);
        }
      } else {
        // Check if selection matches content inside a pair — expand to include delimiters
        let expandedPair = null;

        for (const [open, close] of delimiters) {
          const beforeStart = sel.start.character - open.length;
          const afterEnd = sel.end.character + close.length;

          if (beforeStart >= 0 && afterEnd <= line.length) {
            const beforeText = line.substring(beforeStart, sel.start.character);
            const afterText = line.substring(sel.end.character, afterEnd);

            if (beforeText === open && afterText === close) {
              expandedPair = {
                start: new vscode.Position(sel.start.line, beforeStart),
                end: new vscode.Position(sel.end.line, afterEnd)
              };
              break;
            }
          }
        }

        if (expandedPair) {
          newSel = new vscode.Selection(expandedPair.start, expandedPair.end);
        }
      }
    }

    // No expansion/jump or no selection — find next pair
    if (!newSel) {
      const startLine = sel.active.line;
      const startChar = sel.isEmpty ? sel.active.character : sel.end.character;
      const selectedPair = findNextPair(doc, delimiters, startLine, startChar);

      if (selectedPair) {
        newSel = pairToSelection(selectedPair);
      }
    }

    newSelections.push(newSel || sel);
  }

  editor.selections = newSelections;
}

function removeSurround() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const delimiters = getDelimiters();
  const doc = editor.document;

  editor.edit(editBuilder => {
    for (const sel of editor.selections) {
      const line = doc.lineAt(sel.active.line).text;
      const cursor = sel.active.character;
      let found = null;

      for (const [open, close] of delimiters) {
        const leftIndex = line.lastIndexOf(open, cursor);
        const rightSearchStart = Math.max(cursor - open.length + 1, 0);
        const rightIndex = line.indexOf(close, rightSearchStart);

        if (
          leftIndex !== -1 &&
          rightIndex !== -1 &&
          leftIndex + open.length <= rightIndex
        ) {
          if (
            !found ||
            leftIndex > found.leftIndex ||
            (leftIndex === found.leftIndex && rightIndex < found.rightIndex)
          ) {
            found = { open, close, leftIndex, rightIndex };
          }
        }
      }

      if (found) {
        const content = line.slice(found.leftIndex + found.open.length, found.rightIndex);
        editBuilder.replace(
          new vscode.Range(sel.active.line, found.leftIndex, sel.active.line, found.rightIndex + found.close.length),
          content
        );
      }
    }
  });
}

// ── Helpers ──

function findNextPair(doc, delimiters, fromLine, fromChar, maxLine) {
  const limit = maxLine !== undefined ? maxLine : doc.lineCount - 1;

  for (let lineNum = fromLine; lineNum <= limit; lineNum++) {
    const text = doc.lineAt(lineNum).text;
    let pairs = [];

    for (const [open, close] of delimiters) {
      let idx = 0;
      while (true) {
        const openIdx = text.indexOf(open, idx);
        if (openIdx === -1) break;
        const closeIdx = text.indexOf(close, openIdx + open.length);
        if (closeIdx === -1) break;
        if (lineNum === fromLine && openIdx + open.length <= fromChar && closeIdx <= fromChar) {
          idx = openIdx + open.length;
          continue;
        }
        pairs.push({ open, close, openIdx, closeIdx, lineNum });
        idx = openIdx + open.length;
      }
    }

    if (pairs.length) {
      pairs.sort((a, b) => a.lineNum - b.lineNum || a.openIdx - b.openIdx);
      return pairs[0];
    }
  }
  return null;
}

function pairToSelection(pair) {
  const start = new vscode.Position(pair.lineNum, pair.openIdx + pair.open.length);
  const end = new vscode.Position(pair.lineNum, pair.closeIdx);
  return new vscode.Selection(start, end);
}

module.exports = { selectSurround, removeSurround };
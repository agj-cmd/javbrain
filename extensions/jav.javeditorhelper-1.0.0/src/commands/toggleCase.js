const vscode = require('vscode');

/**
 * Toggle case. Supports multiple cursors.
 *
 * With selection:  lower → UPPER → Title → lower
 * Without selection: word under cursor, lower → Sentence → lower
 *
 * All cursors cycle based on the state of the FIRST selection/word.
 */
function toggleCase() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const doc = editor.document;
  const sels = editor.selections;

  // Build list of { range, text } for each cursor
  const items = [];
  for (const sel of sels) {
    if (!sel.isEmpty) {
      items.push({ range: sel, text: doc.getText(sel) });
    } else {
      const wordRange = doc.getWordRangeAtPosition(sel.active);
      if (wordRange) {
        items.push({ range: wordRange, text: doc.getText(wordRange) });
      }
    }
  }
  if (items.length === 0) return;

  // Determine cycle state from first item
  const hasSelection = !sels[0].isEmpty;
  const ref = items[0].text;
  const nextFn = hasSelection ? cycleThreeState(ref) : cycleTwoState(ref);

  editor.edit(editBuilder => {
    for (const { range, text } of items) {
      editBuilder.replace(range, nextFn(text));
    }
  });
}

/**
 * 3-state for selections: lower → UPPER → Title Case → lower
 * Returns a transform function based on the reference text's current state.
 */
function cycleThreeState(ref) {
  const lower = ref.toLowerCase();
  const upper = ref.toUpperCase();

  if (ref === lower) return t => t.toUpperCase();
  if (ref === upper) return t => toTitleCase(t);
  return t => t.toLowerCase();
}

/**
 * 2-state for no-selection (word): lower → Sentence → lower
 */
function cycleTwoState(ref) {
  const lower = ref.toLowerCase();
  if (ref === lower) {
    return t => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
  }
  return t => t.toLowerCase();
}

function toTitleCase(str) {
  return str.replace(/\S+/g, w =>
    w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
  );
}

module.exports = { toggleCase };
const vscode = require('vscode');

// Decoration for flash animation
const flashDecoration = vscode.window.createTextEditorDecorationType({
  backgroundColor: 'rgba(255,0,0,0.3)'
});

/**
 * Flash a range red, then delete it.
 */
async function flashThenDelete(editor, range) {
  editor.setDecorations(flashDecoration, [range]);
  await new Promise(resolve => setTimeout(resolve, 50));
  editor.setDecorations(flashDecoration, []);
  await editor.edit(e => e.delete(range));
}

/**
 * Collapse multiple adjacent spaces around cursor to one.
 */
async function normalizeWhitespace(editor) {
  const doc = editor.document;
  const pos = editor.selection.active;
  const lineText = doc.lineAt(pos.line).text;

  let wsStart = pos.character;
  while (wsStart > 0 && lineText[wsStart - 1] === ' ') wsStart--;
  let wsEnd = pos.character;
  while (wsEnd < lineText.length && lineText[wsEnd] === ' ') wsEnd++;

  if (wsEnd - wsStart > 1) {
    const range = new vscode.Range(pos.line, wsStart, pos.line, wsEnd);
    await editor.edit(edit => edit.replace(range, ' '));
    const newPos = new vscode.Position(pos.line, wsStart + 1);
    editor.selection = new vscode.Selection(newPos, newPos);
  }
}

/**
 * Collapse adjacent punctuation run around cursor to single leftmost char.
 */
async function normalizePunctuation(editor) {
  const doc = editor.document;
  const pos = editor.selection.active;
  const lineText = doc.lineAt(pos.line).text;

  let start = pos.character;
  while (start > 0 && /[^\w\s]/.test(lineText[start - 1])) start--;
  let end = pos.character;
  while (end < lineText.length && /[^\w\s]/.test(lineText[end])) end++;

  if (end - start > 1) {
    const keep = lineText[start];
    const range = new vscode.Range(pos.line, start, pos.line, end);
    await editor.edit(edit => edit.replace(range, keep));
    const newPos = new vscode.Position(pos.line, start + 1);
    editor.selection = new vscode.Selection(newPos, newPos);
  }
}

/**
 * SmartDelete command.
 *
 * Cases:
 * 1. Selection or multi-cursor → default delete, then normalize
 * 2. Empty line at col 0 → join with next line (skip indentation)
 * 3. Cursor inside a word → delete whole word
 * 4. Cursor at end-of-word →
 *      (a) strip trailing punctuation from token, check suffix on alpha core first
 *      (b) if no suffix match, delete one trailing punctuation char
 *      (c) else delete whole word left + leftward whitespace
 * 5. Cursor at start-of-word → delete word-right + one whitespace
 * 6. Cursor on whitespace / EOL → delete contiguous whitespace toward nearest word
 * 7. Fallback → nothing to delete
 */
async function smartDelete() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;
  const doc = editor.document;
  const selections = editor.selections;
  const nothing = () => vscode.window.showInformationMessage('Nothing to delete');

  // 1. Selection or multi-cursor → default delete
  if (selections.length > 1 || !selections[0].isEmpty) {
    await vscode.commands.executeCommand('deleteRight');
    await normalizeWhitespace(editor);
    await normalizeWhitespace(editor);
    await normalizePunctuation(editor);
    return;
  }

  const sel = selections[0];
  const pos = sel.active;
  const line = doc.lineAt(pos.line);
  const text = line.text;
  const offset = pos.character;

  // 2. Empty line at col 0 → join lines
  if (offset === 0 && text.length === 0 && pos.line < doc.lineCount - 1) {
    const nextLine = doc.lineAt(pos.line + 1);
    const indentEnd = nextLine.firstNonWhitespaceCharacterIndex;
    const range = new vscode.Range(
      new vscode.Position(pos.line, 0),
      new vscode.Position(pos.line + 1, indentEnd)
    );
    await flashThenDelete(editor, range);
    return;
  }

  // Compute word boundaries (whitespace-delimited token)
  let start = offset;
  while (start > 0 && !/\s/.test(text[start - 1])) start--;
  let end = offset;
  while (end < text.length && !/\s/.test(text[end])) end++;

  const atStart = offset === start;
  const atEnd = offset === end;
  const inside = offset > start && offset < end;

  // 3. Inside a word → delete whole word
  if (inside) {
    const range = new vscode.Range(pos.line, start, pos.line, end);
    await flashThenDelete(editor, range);
    return;
  }

  // 4. At end-of-word → suffix first, then punctuation, then whole-word-left
  if (atEnd && offset > start) {
    const token = text.slice(start, end);

    // Find where trailing punctuation begins
    let alphaEnd = end;
    while (alphaEnd > start && /[^\w]/.test(text[alphaEnd - 1])) alphaEnd--;
    const alphaCore = text.slice(start, alphaEnd);
    const hasTrailingPunct = alphaEnd < end;

    // (a) Suffix check — test against alpha core (ignoring trailing punctuation)
    if (alphaCore.length > 0) {
      const cfg = vscode.workspace.getConfiguration('smartDelete');
      const suffixes = (cfg.get('suffixes') || [])
        .slice().sort((a, b) => b.length - a.length);
      const lowerCore = alphaCore.toLowerCase();

      for (const suf of suffixes) {
        if (lowerCore.endsWith(suf.toLowerCase()) && suf.length < alphaCore.length) {
          // Delete the suffix portion (between alphaEnd - suf.length and alphaEnd)
          const range = new vscode.Range(pos.line, alphaEnd - suf.length, pos.line, alphaEnd);
          await flashThenDelete(editor, range);
          return;
        }
      }
    }

    // (b) Punctuation — delete one trailing punctuation char
    if (hasTrailingPunct) {
      const charBefore = text[offset - 1];
      if (/[^\w\s]/.test(charBefore)) {
        const range = new vscode.Range(pos.line, offset - 1, pos.line, offset);
        await flashThenDelete(editor, range);
        return;
      }
    }

    // Also handle punctuation when cursor is right after it (no trailing punct scenario)
    const charBefore = text[offset - 1];
    if (/[^\w\s]/.test(charBefore)) {
      const range = new vscode.Range(pos.line, offset - 1, pos.line, offset);
      await flashThenDelete(editor, range);
      return;
    }

    // (c) Whole-word-left + leftward whitespace
    let wsStart = start;
    while (wsStart > 0 && text[wsStart - 1] === ' ') wsStart--;
    const range = new vscode.Range(pos.line, wsStart, pos.line, offset);
    await flashThenDelete(editor, range);
    return;
  }

  // 5. At start-of-word → delete word-right + one whitespace
  if (atStart && offset < end) {
    const includeWS = (end < text.length && /\s/.test(text[end])) ? 1 : 0;
    const range = new vscode.Range(pos.line, start, pos.line, end + includeWS);
    await flashThenDelete(editor, range);
    return;
  }

  // 6. Cursor on whitespace or at EOL → delete contiguous whitespace toward nearest word
  if (/\s/.test(text[offset] || '') || offset === text.length) {
    let wsStart = offset;
    while (wsStart > 0 && /\s/.test(text[wsStart - 1])) wsStart--;
    let wsEnd = offset;
    while (wsEnd < text.length && /\s/.test(text[wsEnd])) wsEnd++;

    // EOL: include next-line indent
    if (offset === text.length && pos.line < doc.lineCount - 1) {
      const nextLine = doc.lineAt(pos.line + 1);
      const indentEnd = nextLine.firstNonWhitespaceCharacterIndex;
      const range = new vscode.Range(
        new vscode.Position(pos.line, wsStart),
        new vscode.Position(pos.line + 1, indentEnd)
      );
      await flashThenDelete(editor, range);
      return;
    }

    const distLeft = offset - wsStart;
    const distRight = wsEnd - offset;

    if (wsStart < offset && distLeft <= distRight) {
      const range = new vscode.Range(pos.line, wsStart, pos.line, offset);
      await flashThenDelete(editor, range);
      return;
    }
    if (wsEnd > offset) {
      const range = new vscode.Range(pos.line, offset, pos.line, wsEnd);
      await flashThenDelete(editor, range);
      return;
    }
    nothing();
    return;
  }

  // 7. Fallback
  nothing();

  await normalizeWhitespace(editor);
}

module.exports = { smartDelete };
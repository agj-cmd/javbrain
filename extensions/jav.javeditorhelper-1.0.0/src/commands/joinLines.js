const vscode = require('vscode');

const reUnicodeWS =
  /[\t \u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]+/g;
const reLeadingWS =
  /^[\t \u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]+/;

function clean(text) {
  return text.replace(reLeadingWS, '').trimEnd().replace(reUnicodeWS, ' ');
}

/**
 * Collect line ranges from all selections, expanding single-line cursors
 * in the given direction, then merge overlapping/adjacent ranges.
 *
 * @param {'above'|'below'|null} direction  — expand direction for cursors
 *        (null means only multiline selections get joined, cursors are skipped)
 */
function collectRanges(editor, direction) {
  const doc = editor.document;
  const lastLine = doc.lineCount - 1;
  const raw = [];

  for (const sel of editor.selections) {
    const top = Math.min(sel.anchor.line, sel.active.line);
    const bot = Math.max(sel.anchor.line, sel.active.line);

    if (top !== bot) {
      // Multiline selection — always join all lines regardless of direction.
      raw.push({ start: top, end: bot });
    } else if (direction === 'above' && top > 0) {
      raw.push({ start: top - 1, end: top });
    } else if (direction === 'below' && top < lastLine) {
      raw.push({ start: top, end: top + 1 });
    }
  }

  if (raw.length === 0) return [];

  // Sort ascending, then merge overlapping / adjacent.
  raw.sort((a, b) => a.start - b.start || a.end - b.end);
  const merged = [{ ...raw[0] }];
  for (let i = 1; i < raw.length; i++) {
    const prev = merged[merged.length - 1];
    if (raw[i].start <= prev.end) {          // overlapping or touching
      prev.end = Math.max(prev.end, raw[i].end);
    } else {
      merged.push({ ...raw[i] });
    }
  }
  return merged;
}

/**
 * Run the join for a set of merged line ranges (bottom-up to keep indices stable).
 */
function executeJoin(editor, ranges) {
  const doc = editor.document;

  // Process bottom-up.
  const sorted = [...ranges].sort((a, b) => b.start - a.start);

  const edits = sorted.map(r => {
    const indent = doc.lineAt(r.start).text.match(reLeadingWS)?.[0] ?? '';
    const parts = [];
    for (let i = r.start; i <= r.end; i++) {
      parts.push(clean(doc.lineAt(i).text));
    }
    const text = indent + parts.join(' ');
    return {
      range: new vscode.Range(
        doc.lineAt(r.start).range.start,
        doc.lineAt(r.end).range.end
      ),
      text,
      resultLine: r.start,
      linesRemoved: r.end - r.start,
      cursorCol: indent.length + parts[0].length + (parts.length > 1 ? 1 : 0),
    };
  });

  editor.edit(
    eb => { for (const e of edits) eb.replace(e.range, e.text); },
    { undoStopBefore: true, undoStopAfter: true }
  ).then(ok => {
    if (!ok) return;

    // Walk ascending, accumulating line-shift from earlier joins.
    const ascending = [...edits].reverse();
    let shift = 0;
    const positions = ascending.map(e => {
      const pos = new vscode.Position(e.resultLine - shift, e.cursorCol);
      shift += e.linesRemoved;
      return pos;
    });

    editor.selections = positions.map(p => new vscode.Selection(p, p));
  });
}

function joinLineAbove() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;
  const ranges = collectRanges(editor, 'above');
  if (ranges.length) executeJoin(editor, ranges);
}

function joinLineBelow() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;
  const ranges = collectRanges(editor, 'below');
  if (ranges.length) executeJoin(editor, ranges);
}

module.exports = { joinLineAbove, joinLineBelow };
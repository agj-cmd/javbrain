const vscode = require('vscode');

const proseLanguages = new Set(['jav', 'plaintext', 'markdown']);

const clauseChars = new Set(['.', '!', '?', ',', ';', ':', '\u2014', '\u2013', '(', ')', '[', ']', '"', '\u201C', '\u201D']);
const sentenceChars = new Set(['.', '!', '?']);

// ── Line parser ──────────────────────────────────────────────────────

function parseLine(lineText) {
  const words = parseWords(lineText);
  const clauses = splitAt(lineText, clauseChars);
  const sentences = splitAt(lineText, sentenceChars);
  return { words, clauses, sentences };
}

function parseWords(lineText) {
  const words = [];
  const re = /\w+/g;
  let m;
  while ((m = re.exec(lineText)) !== null) {
    words.push({ start: m.index, end: m.index + m[0].length });
  }
  return words;
}

function splitAt(lineText, boundarySet) {
  const segs = [];
  let segStart = 0;
  for (let i = 0; i < lineText.length; i++) {
    if (boundarySet.has(lineText[i])) {
      segs.push({ start: segStart, end: i + 1 });
      segStart = i + 1;
    }
  }
  if (segStart < lineText.length) {
    segs.push({ start: segStart, end: lineText.length });
  }
  return segs.filter(s => /\S/.test(lineText.slice(s.start, s.end)));
}

// ── Span helpers ─────────────────────────────────────────────────────

function containingSpan(segments, selStart, selEnd, lineText) {
  if (segments.length === 0) return null;

  let left = 0;
  for (let i = 0; i < segments.length; i++) {
    if (segments[i].end > selStart) { left = i; break; }
  }

  let right = segments.length - 1;
  for (let i = segments.length - 1; i >= 0; i--) {
    if (segments[i].start < selEnd) { right = i; break; }
  }

  let start = segments[left].start;
  let end = segments[right].end;

  while (start < selStart && lineText[start] === ' ') start++;
  while (end > selEnd && lineText[end - 1] === ' ') end--;

  if (start < selStart || end > selEnd) {
    return { start, end };
  }
  return null;
}

/**
 * Find the word the cursor is in or nearest to (bare word, no whitespace).
 */
function wordAt(words, col) {
  if (words.length === 0) return null;

  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (col >= w.start && col <= w.end) {
      return { start: w.start, end: w.end };
    }
    const dist = col < w.start ? w.start - col : col - w.end;
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return { start: words[best].start, end: words[best].end };
}

/**
 * Find the word at/near col, then absorb surrounding whitespace.
 */
function wordSpanAt(words, col, lineText) {
  const w = wordAt(words, col);
  if (!w) return null;

  let start = w.start;
  let end = w.end;
  const hasLeft = start > 0 && lineText[start - 1] === ' ';
  const hasRight = end < lineText.length && lineText[end] === ' ';

  if (hasLeft) {
    while (start > 0 && lineText[start - 1] === ' ') start--;
  }
  if (hasRight && !hasLeft) {
    while (end < lineText.length && lineText[end] === ' ') end++;
  }

  return { start, end };
}

// ── Command ──────────────────────────────────────────────────────────

/**
 * Smart Select: Expand
 *
 * .jav / plaintext / markdown:
 *   No selection → word (bare)
 *   Word selected → word + surrounding whitespace
 *   Then → clause → sentence → trimmed line → full line
 *
 * Other languages → built-in smartSelect.expand
 */
async function smartSelect() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  if (!proseLanguages.has(editor.document.languageId)) {
    return vscode.commands.executeCommand('editor.action.smartSelect.expand');
  }

  const doc = editor.document;
  const sel = editor.selection;
  const lineNum = sel.active.line;
  const lineText = doc.lineAt(lineNum).text;
  if (lineText.length === 0) return;

  const parsed = parseLine(lineText);

  // ── No selection: pick word only (no whitespace) ──
  if (sel.isEmpty) {
    const word = wordAt(parsed.words, sel.active.character);
    if (word) {
      editor.selection = new vscode.Selection(
        new vscode.Position(lineNum, word.start),
        new vscode.Position(lineNum, word.end)
      );
    }
    return;
  }

  // ── Has selection: walk up the hierarchy ──
  const selStart = sel.start.character;
  const selEnd = sel.end.character;

  // Level 0: word → word + surrounding whitespace
  // Only applies when selection is exactly a bare word
  const exactWord = parsed.words.find(w => w.start === selStart && w.end === selEnd);
  if (exactWord) {
    const wsSpan = wordSpanAt(parsed.words, selStart, lineText);
    if (wsSpan && (wsSpan.start < selStart || wsSpan.end > selEnd)) {
      editor.selection = new vscode.Selection(
        new vscode.Position(lineNum, wsSpan.start),
        new vscode.Position(lineNum, wsSpan.end)
      );
      return;
    }
  }

  // Level 1: clause
  const clause = containingSpan(parsed.clauses, selStart, selEnd, lineText);
  if (clause) {
    editor.selection = new vscode.Selection(
      new vscode.Position(lineNum, clause.start),
      new vscode.Position(lineNum, clause.end)
    );
    return;
  }

  // Level 2: sentence
  const sentence = containingSpan(parsed.sentences, selStart, selEnd, lineText);
  if (sentence) {
    editor.selection = new vscode.Selection(
      new vscode.Position(lineNum, sentence.start),
      new vscode.Position(lineNum, sentence.end)
    );
    return;
  }

  // Level 3: trimmed line
  const trimStart = lineText.search(/\S/);
  let trimEnd = lineText.length;
  while (trimEnd > 0 && /\s/.test(lineText[trimEnd - 1])) trimEnd--;
  if (trimStart >= 0 && (trimStart < selStart || trimEnd > selEnd)) {
    editor.selection = new vscode.Selection(
      new vscode.Position(lineNum, trimStart),
      new vscode.Position(lineNum, trimEnd)
    );
    return;
  }

  // Level 4: full line
  if (selStart > 0 || selEnd < lineText.length) {
    editor.selection = new vscode.Selection(
      new vscode.Position(lineNum, 0),
      new vscode.Position(lineNum, lineText.length)
    );
  }
}

module.exports = { smartSelect };

// src/commands/textCleanup.js
const vscode = require('vscode');
const { getGlossary } = require('../config');


const flashDecoration = vscode.window.createTextEditorDecorationType({
    color: '#f00',
    isWholeLine: true

});

// pass 1: normalize case to glossary (uses pre-compiled normRe)
function normalizeCase(text, entries) {
  let out = text;
  for (const { key, normRe, hasSuffix } of entries) {
    normRe.lastIndex = 0;
    out = out.replace(normRe, function () {
      const args = Array.from(arguments);
      const lead = args[1] || '';
      const suf = hasSuffix ? (args[3] || '') : '';
      const trail = hasSuffix ? (args[4] || '') : (args[3] || '');
      return `${lead}${key}${suf}${trail}`;
    });
  }
  return out;
}

// pass 2: enforce single-star wrapping (uses pre-compiled starRe)
function enforceStars(text, entries) {
  let out = text;
  for (const { key, starred, starRe } of entries) {
    if (!starred) continue;
    starRe.lastIndex = 0;
    out = out.replace(starRe, function () {
      const args = Array.from(arguments);
      const suf = args[2] || '';
      return `*${key}${suf}*`;
    });
  }
  return out;
}

// sentence-start capitalization
function capitalizeSentenceStarts(text) {
  // start of text / line: first non-letter then first [a-z]
  text = text.replace(/(^|\n)([^A-Za-z]*)([a-z])/g, function () {
    const args = Array.from(arguments);
    const prefix = args[1] || '';
    const gap = args[2] || '';
    const c = args[3] || '';
    return prefix + gap + c.toUpperCase();
  });

  // after period: always capitalize
  text = text.replace(/(\.)([^A-Za-z]*)([a-z])/g, function () {
    const args = Array.from(arguments);
    const p = args[1] || '';
    const gap = args[2] || '';
    const c = args[3] || '';
    return p + gap + c.toUpperCase();
  });

  // after ? or !: always capitalize
  return text.replace(/([?!])([^A-Za-z]*)([a-z])/g, function () {
    const args = Array.from(arguments);
    const p = args[1] || '';
    const gap = args[2] || '';
    const c = args[3] || '';
    return p + gap + c.toUpperCase();
  });
}

// capitalize first word in quotes only if it starts a new sentence
function capitalizeDialogue(text) {
  return text.replace(/(["""])(\s*)([a-z])/g, function() {
    const args = Array.from(arguments);
    const quote = args[1] || '';
    const space = args[2] || '';
    const firstChar = args[3] || '';
    const offset = args[args.length - 2];

    const beforeQuote = text.substring(0, offset);
    const quoteCount = (beforeQuote.match(/["""]/g) || []).length;

    // closing quote - skip
    if (quoteCount % 2 === 1) {
      return quote + space + firstChar;
    }

    // find matching closing quote (same type or equivalent)
    const afterStart = offset + quote.length + space.length + 1;
    const afterQuote = text.substring(afterStart);

    // match content up to closing quote, check if ends with sentence punctuation
    const closingMatch = afterQuote.match(/^[^"""]*?([.?!])\s*["""]/);

    if (closingMatch) {
      // punctuation immediately before closing quote = complete sentence
      return quote + space + firstChar.toUpperCase();
    }

    // incomplete quote - don't capitalize
    const beforeText = beforeQuote.trimEnd();
    if (/,\s*$/.test(beforeText)) {
      return quote + space + firstChar;
    }

    // no dialogue tag, but also not a complete sentence - check if at sentence start
    if (/^$|[.?!]\s*$/.test(beforeText)) {
      return quote + space + firstChar.toUpperCase();
    }

    return quote + space + firstChar;
  });
}

async function textCleanup() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const glossary = getGlossary();

  const doc = editor.document;
  const edits = [];

  for (const sel of editor.selections) {
    let range;
    let leadingWhitespace = '';

    if (sel.isEmpty) {
      // For empty selection, get the full line but preserve leading whitespace
      const line = doc.lineAt(sel.start.line);
      const lineText = line.text;

      // Find where the actual content starts (first non-whitespace)
      const contentStart = lineText.search(/\S/);

      if (contentStart === -1) {
        // Line is all whitespace, skip it
        continue;
      }

      // Extract leading whitespace
      leadingWhitespace = lineText.substring(0, contentStart);

      // Create range from first non-whitespace to end of line
      range = new vscode.Range(
        new vscode.Position(line.lineNumber, contentStart),
        line.range.end
      );
    } else {
      // For non-empty selection, use it as-is
      range = sel;

      // Check if selection starts at beginning of line
      if (sel.start.character === 0) {
        const lineText = doc.getText(new vscode.Range(
          new vscode.Position(sel.start.line, 0),
          sel.end
        ));
        const contentStart = lineText.search(/\S/);
        if (contentStart > 0) {
          leadingWhitespace = lineText.substring(0, contentStart);
          // Adjust range to exclude leading whitespace
          range = new vscode.Range(
            new vscode.Position(sel.start.line, contentStart),
            sel.end
          );
        }
      }
    }

    let text = doc.getText(range);

    // normalize base case: lowercase entire selection
    text = text.toLowerCase();

    // minimal baseline cleanup
    text = text.replace(/[ \t]+$/gm, '');               // trim trailing spaces/tabs
    text = text.replace(/\s+([.,!?;:])/g, '$1');        // no space before punctuation
    text = text.replace(/([.,!?;:])([A-Za-z])/g, '$1 $2'); // space after punctuation before letter

    // dash + ellipsis normalization (match longer sequences first)
    text = text.replace(/--/g, '\u2014');    // em dash
    // text = text.replace(/\.{3}/g, '\u2026'); // ellipsis

    // strip unicode em quad and em space
    text = text.replace(/[\u2001\u2003]/g, ' ');

    // collapse internal runs of spaces/tabs
    text = text.replace(/[ \t]{2,}/g, ' ');

    // trim inner space in *...*
    text = text.replace(/\*(\s*)([^*]*?)(\s*)\*/g, function () {
      const args = Array.from(arguments);
      const content = args[2] || '';
      return `*${content.trim()}*`;
    });

    // trim inner space in quotes
    text = text.replace(/(["""])(\s*)(.*?)(\s*)(\1)/g, function () {
      const args = Array.from(arguments);
      const quote = args[1] || '"';
      const content = args[3] || '';
      return quote + content.trim() + quote;
    });

    // pass 1: case
    text = normalizeCase(text, glossary);

    // pass 2: stars
    text = enforceStars(text, glossary);

    // quoted dialogue
    text = capitalizeDialogue(text);

    // sentence starts
    text = capitalizeSentenceStarts(text);



    // If we preserved leading whitespace, prepend it back
    if (leadingWhitespace && range.start.character > 0) {
      // We need to extend the range to include the leading whitespace position
      const fullRange = new vscode.Range(
        new vscode.Position(range.start.line, 0),
        range.end
      );
      edits.push({ range: fullRange, text: leadingWhitespace + text });
    } else {
      edits.push({ range, text });
    }
  }

const applied = await editor.edit(b => {
  for (const e of edits) {
    const oldText = doc.getText(e.range);
    if (oldText.trim() === e.text.trim()) continue;
    b.replace(e.range, e.text);
  }
});

if (applied) {
  const ranges = edits.map(e => e.range);
  editor.setDecorations(flashDecoration, ranges);
  setTimeout(() => editor.setDecorations(flashDecoration, []), 150);
}

}

module.exports = { textCleanup };
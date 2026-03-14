const vscode = require('vscode');

function editDialog() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;
  const doc = editor.document;
  const pos = editor.selection.active;
  const line = doc.lineAt(pos.line).text;
  const regex = /["“”‘’]/g;
  const quoteIndices = [];
  let m;
  while ((m = regex.exec(line))) quoteIndices.push(m.index);

  if (quoteIndices.length === 0) {
    const mm = line.match(/^(\s*)(\d{4}:\s)?(.*)$/);
    const indent = mm ? mm[1] || '' : '';
    const prefix = mm ? mm[2] || '' : '';
    const rest = mm ? mm[3] : line;
    const wrapped = indent + prefix + '"' + rest.trimEnd() + '"';
    editor.edit(b => b.replace(doc.lineAt(pos.line).range, wrapped)).then(() => {
      const end = new vscode.Position(pos.line, wrapped.length);
      editor.selection = new vscode.Selection(end, end);
    });
    return;
  }

  if (quoteIndices.length === 2) {
    const [open, close] = quoteIndices;
    if (!(open < pos.character && pos.character < close)) {
      const nl = line.replace(regex, '');
      const removedLeft = quoteIndices.filter(i => i < pos.character).length;
      editor.edit(b => b.replace(doc.lineAt(pos.line).range, nl)).then(() => {
        const nc = Math.max(0, pos.character - removedLeft);
        const np = new vscode.Position(pos.line, nc);
        editor.selection = new vscode.Selection(np, np);
      });
      return;
    }
  }

  const pairs = [];
  for (let i = 0; i + 1 < quoteIndices.length; i += 2) {
    pairs.push({ open: quoteIndices[i], close: quoteIndices[i+1] });
  }

  for (let i = 0; i + 1 < pairs.length; i++) {
    const f = pairs[i], s = pairs[i+1];
    if (f.close < pos.character && pos.character < s.open) {
      const r1 = line.substring(f.open+1, f.close);
      const r2 = line.substring(s.open+1, s.close);
      const t1 = r1.trim().replace(/[\.,!?;:]+$/, '');
      const jp = /[\.,!?;:]$/.test(r1.trim()) ? r1.trim().slice(-1) : ',';
      const t2 = r2.trim();
      const pfx = line.slice(0, f.open);
      const sfx = line.slice(s.close+1);
      const joined = '"' + t1 + jp + ' ' + t2 + '"';
      const nl = pfx + joined + sfx;
      editor.edit(b => b.replace(doc.lineAt(pos.line).range, nl)).then(() => {
        const col = pfx.length + 1 + t1.length + 1;
        const cp = new vscode.Position(pos.line, col);
        editor.selection = new vscode.Selection(cp, cp);
      });
      return;
    }
  }

  for (const {open, close} of pairs) {
    if (open < pos.character && pos.character < close) {
      const bef = line.substring(0, pos.character);
      const aft = line.substring(pos.character);
      const tb = bef.trimEnd();
      const needC = !/[\.,!?;:]$/.test(tb);
      const left = tb + (needC ? ',"' : '"');
      const right = ' "' + aft.trimStart();
      const nl = left + right;
      editor.edit(b => b.replace(doc.lineAt(pos.line).range, nl)).then(() => {
        const np = new vscode.Position(pos.line, left.length+1);
        editor.selection = new vscode.Selection(np, np);
      });
      return;
    }
  }

  vscode.window.showInformationMessage('No dialog action available');
}






module.exports = { editDialog };

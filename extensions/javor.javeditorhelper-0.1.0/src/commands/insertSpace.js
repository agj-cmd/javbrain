const vscode = require('vscode');

function insertSpace() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const originalSelections = editor.selections.map(sel => sel.active);

  editor.edit(editBuilder => {
    for (const pos of originalSelections) {
      editBuilder.insert(pos, ' ');
    }
  }).then(() => {
    // Reset cursor to original position(s)
    editor.selections = originalSelections.map(pos => new vscode.Selection(pos, pos));
  });
}

module.exports = { insertSpace };

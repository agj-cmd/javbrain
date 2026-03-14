const vscode = require('vscode');

/**
 * Move to the next non-empty line that doesn't start with #
 * and position cursor at the first a-z character
 */
async function goToLineNext() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const document = editor.document;
  const currentPosition = editor.selection.active;
  const totalLines = document.lineCount;
  
  // Start searching from the next line
  for (let lineNum = currentPosition.line + 1; lineNum < totalLines; lineNum++) {
    const line = document.lineAt(lineNum);
    const text = line.text;
    
    // Skip empty lines and lines starting with #
    if (text.trim() === '' || text.trimStart().startsWith('#')) {
      continue;
    }
    
    // Find the first a-z character (case-insensitive)
    const match = text.match(/[a-z]/i);
    if (match) {
      const charIndex = match.index;
      const newPosition = new vscode.Position(lineNum, charIndex);
      editor.selection = new vscode.Selection(newPosition, newPosition);
      editor.revealRange(new vscode.Range(newPosition, newPosition));
      return;
    } else {
      // If no a-z character found but line is valid, go to first non-whitespace
      const firstNonWhitespace = line.firstNonWhitespaceCharacterIndex;
      const newPosition = new vscode.Position(lineNum, firstNonWhitespace);
      editor.selection = new vscode.Selection(newPosition, newPosition);
      editor.revealRange(new vscode.Range(newPosition, newPosition));
      return;
    }
  }
  
  // If no valid line found, show a message
  vscode.window.showInformationMessage('No more valid lines below');
}

/**
 * Move to the previous non-empty line that doesn't start with #
 * and position cursor at the first a-z character
 */
async function goToLinePrevious() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const document = editor.document;
  const currentPosition = editor.selection.active;
  
  // Start searching from the previous line
  for (let lineNum = currentPosition.line - 1; lineNum >= 0; lineNum--) {
    const line = document.lineAt(lineNum);
    const text = line.text;
    
    // Skip empty lines and lines starting with #
    if (text.trim() === '' || text.trimStart().startsWith('#')) {
      continue;
    }
    
    // Find the first a-z character (case-insensitive)
    const match = text.match(/[a-z]/i);
    if (match) {
      const charIndex = match.index;
      const newPosition = new vscode.Position(lineNum, charIndex);
      editor.selection = new vscode.Selection(newPosition, newPosition);
      editor.revealRange(new vscode.Range(newPosition, newPosition));
      return;
    } else {
      // If no a-z character found but line is valid, go to first non-whitespace
      const firstNonWhitespace = line.firstNonWhitespaceCharacterIndex;
      const newPosition = new vscode.Position(lineNum, firstNonWhitespace);
      editor.selection = new vscode.Selection(newPosition, newPosition);
      editor.revealRange(new vscode.Range(newPosition, newPosition));
      return;
    }
  }
  
  // If no valid line found, show a message
  vscode.window.showInformationMessage('No more valid lines above');
}

module.exports = {
  goToLineNext,
  goToLinePrevious
};
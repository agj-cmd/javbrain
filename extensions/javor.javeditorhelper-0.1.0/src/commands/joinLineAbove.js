const vscode = require('vscode');

/**
 * Joins the current line with the line above it
 * Moves the cursor to the join point
 */
function joinLineAbove() {
    const editor = vscode.window.activeTextEditor;
    
    if (!editor) {
        return;
    }

    const document = editor.document;
    const selection = editor.selection;
    const currentLine = selection.active.line;

    // Can't join if we're on the first line
    if (currentLine === 0) {
        vscode.window.showInformationMessage('Already at the first line');
        return;
    }

    const lineAbove = document.lineAt(currentLine - 1);
    const currentLineObj = document.lineAt(currentLine);
    
    // Get the text content (trimmed for current line to remove leading spaces)
    const lineAboveText = lineAbove.text;
    const currentLineText = currentLineObj.text.trimStart();
    
    // Calculate where the cursor should be (at the join point)
    // This is the length of the line above + 1 for the space we'll add
    const cursorPosition = lineAboveText.length + 1;
    
    // Perform the edit
    editor.edit(editBuilder => {
        // Range from start of line above to end of current line
        const range = new vscode.Range(
            lineAbove.range.start,
            currentLineObj.range.end
        );
        
        // Join with a single space
        const joinedText = lineAboveText + ' ' + currentLineText;
        
        editBuilder.replace(range, joinedText);
    }).then(success => {
        if (success) {
            // Move cursor to the join point
            const newPosition = new vscode.Position(currentLine - 1, cursorPosition);
            editor.selection = new vscode.Selection(newPosition, newPosition);
        }
    });
}

module.exports = {
    joinLineAbove
};
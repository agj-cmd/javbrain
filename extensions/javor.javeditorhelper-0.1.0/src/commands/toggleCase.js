const vscode = require('vscode');

function toggleCase() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const document = editor.document;
    const selections = editor.selections;

    editor.edit(editBuilder => {
        // Multi-cursor mode: cycle through lower -> upper
        if (selections.length > 1) {
            const firstText = document.getText(selections[0]);
            const isLower = firstText === firstText.toLowerCase();
            
            selections.forEach(selection => {
                const text = document.getText(selection);
                const newText = isLower ? text.toUpperCase() : text.toLowerCase();
                editBuilder.replace(selection, newText);
            });
            return;
        }

        // Single cursor
        const selection = selections[0];
        
        if (!selection.isEmpty) {
            // Has selection: toggle upper/lower
            const text = document.getText(selection);
            const isLower = text === text.toLowerCase();
            editBuilder.replace(selection, isLower ? text.toUpperCase() : text.toLowerCase());
        } else {
            // No selection: find nearest word and toggle lower/sentence
            const position = selection.active;
            const wordRange = document.getWordRangeAtPosition(position);
            
            if (!wordRange) return;
            
            const word = document.getText(wordRange);
            const isLower = word === word.toLowerCase();
            const newWord = isLower 
                ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                : word.toLowerCase();
            
            editBuilder.replace(wordRange, newWord);
        }
    });
}

module.exports = { toggleCase };
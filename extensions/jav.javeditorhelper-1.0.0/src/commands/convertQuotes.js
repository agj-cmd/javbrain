const vscode = require('vscode');

// Convert straight quotes to curly quotes
function smartCurly(text) {
    // normalize so re-curly always applies
    text = text.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'");
    
    // Find distance to nearest whitespace in a direction
    function distanceToWhitespace(str, pos, direction) {
        let distance = 0;
        let i = pos + direction;
        
        while (i >= 0 && i < str.length && !/\s/.test(str[i])) {
            distance++;
            i += direction;
        }
        
        // If we hit string boundary, treat as whitespace at distance+1
        if (i < 0 || i >= str.length) distance++;
        
        return distance;
    }
    
    // double quotes - point away from nearest whitespace
    text = text.replace(/"/g, (m, i, s) => {
        const leftDistance = distanceToWhitespace(s, i, -1);
        const rightDistance = distanceToWhitespace(s, i, 1);
        
        if (leftDistance < rightDistance) return '\u201C'; // " opening (points away from left)
        if (rightDistance < leftDistance) return '\u201D'; // " closing (points away from right)
        
        // Equal distance - default to opening
        return '\u201C'; // "
    });
    
    // single quotes - handle contractions first, then point away from nearest whitespace
    text = text.replace(/'/g, (m, i, s) => {
        const leftChar = i > 0 ? s[i - 1] : ' ';
        const rightChar = i < s.length - 1 ? s[i + 1] : ' ';
        
        // Special case: contractions (letter-apostrophe-letter)
        if (/[a-zA-Z]/.test(leftChar) && /[a-zA-Z]/.test(rightChar)) {
            return '\u2019'; // ' always apostrophe for contractions like i'd, don't
        }
        
        const leftDistance = distanceToWhitespace(s, i, -1);
        const rightDistance = distanceToWhitespace(s, i, 1);
        
        if (leftDistance < rightDistance) return '\u2018'; // ' opening (points away from left)
        if (rightDistance < leftDistance) return '\u2019'; // ' closing (points away from right)
        
        // Equal distance - default to opening
        return '\u2018'; // '
    });
    
    
    return text;
}

// Convert curly quotes to straight quotes
function toStraight(text) {
    return text
        .replace(/[\u201C\u201D]/g, '"')  // " and " to "
        .replace(/[\u2018\u2019]/g, "'")  // ' and ' to '
}

// VS Code integration function
async function run(conversionFunction) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('No active text editor found');
        return;
    }
    
    try {
        await editor.edit(builder => {
            for (const selection of editor.selections) {
                const range = selection.isEmpty 
                    ? new vscode.Range(
                        editor.document.positionAt(0), 
                        editor.document.positionAt(editor.document.getText().length)
                    )
                    : selection;
                
                const originalText = editor.document.getText(range);
                const convertedText = conversionFunction(originalText);
                
                console.log('Original:', originalText.substring(0, 100));
                console.log('Converted:', convertedText.substring(0, 100));
                
                builder.replace(range, convertedText);
            }
        });
    } catch (error) {
        vscode.window.showErrorMessage(`Conversion failed: ${error.message}`);
    }
}

// Exported functions for VS Code commands
async function convertToCurlyQuotation() {
    await run(smartCurly);
}

async function convertToStraightQuotation() {
    await run(toStraight);
}

module.exports = { 
    convertToCurlyQuotation, 
    convertToStraightQuotation 
};
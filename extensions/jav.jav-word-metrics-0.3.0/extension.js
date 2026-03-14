const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

function activate(context) {
    const cmds = [
        ['freq.charFile',    false, countCharsInFile,   'Char Frequency'],
        ['freq.charFolder',  true,  countCharsInFile,   'Char Frequency'],
        ['freq.wordFile',    false, countWordsInFile,    'Word Frequency'],
        ['freq.wordFolder',  true,  countWordsInFile,    'Word Frequency'],
        ['freq.phraseFile',  false, countPhrasesInFile,  'Phrase Frequency'],
        ['freq.phraseFolder',true,  countPhrasesInFile,  'Phrase Frequency'],
    ];

    for (const [id, isFolder, countFn, label] of cmds) {
        context.subscriptions.push(
            vscode.commands.registerCommand(id, (uri) => {
                if (isFolder) {
                    if (!uri) { vscode.window.showErrorMessage('No folder selected.'); return; }
                    const freq = processFolder(uri.fsPath, countFn);
                    showResults(freq, `${label}: ${path.basename(uri.fsPath)}/`);
                } else {
                    const fp = uri ? uri.fsPath : vscode.window.activeTextEditor?.document.uri.fsPath;
                    if (!fp) { vscode.window.showErrorMessage('No file selected.'); return; }
                    const freq = countFn(fp);
                    showResults(freq, `${label}: ${path.basename(fp)}`);
                }
            })
        );
    }
}

function readFile(filePath) {
    try { return fs.readFileSync(filePath, 'utf-8'); } catch { return ''; }
}

function countCharsInFile(filePath) {
    const freq = {};
    const text = readFile(filePath).toLowerCase();
    for (const ch of text) {
        if (/\s/.test(ch)) continue;
        freq[ch] = (freq[ch] || 0) + 1;
    }
    return freq;
}

function countWordsInFile(filePath) {
    const freq = {};
    const text = readFile(filePath).toLowerCase();
    const words = text.match(/[a-z'-]+/g) || [];
    for (const w of words) {
        freq[w] = (freq[w] || 0) + 1;
    }
    return freq;
}

function countPhrasesInFile(filePath) {
    const freq = {};
    const text = readFile(filePath).toLowerCase();
    // split into sentences on . ? ! and newlines to avoid cross-sentence phrases
    const sentences = text.split(/[.?!\n\r]+/);
    for (const sentence of sentences) {
        const words = sentence.match(/[a-z'-]+/g) || [];
        if (words.length < 2) continue;
        // generate n-grams from 2 to 5
        for (let n = 2; n <= 5; n++) {
            for (let i = 0; i <= words.length - n; i++) {
                const phrase = words.slice(i, i + n).join(' ');
                freq[phrase] = (freq[phrase] || 0) + 1;
            }
        }
    }
    // only keep phrases that repeat (count >= 2)
    for (const key of Object.keys(freq)) {
        if (freq[key] < 2) delete freq[key];
    }
    return freq;
}

function processFolder(dirPath, countFn) {
    const freq = {};
    const walk = (dir) => {
        let entries;
        try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
        for (const entry of entries) {
            if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) walk(full);
            else if (entry.isFile()) merge(freq, countFn(full));
        }
    };
    walk(dirPath);
    return freq;
}

function merge(target, source) {
    for (const [key, count] of Object.entries(source)) {
        target[key] = (target[key] || 0) + count;
    }
}

function showResults(freq, title) {
    const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
    if (sorted.length === 0) {
        vscode.window.showInformationMessage('Nothing found.');
        return;
    }
    const total = sorted.reduce((sum, [, c]) => sum + c, 0);
    const maxKeyLen = Math.min(Math.max(...sorted.slice(0, 200).map(([k]) => k.length)), 40);
    const col1 = Math.max(maxKeyLen + 2, 6);
    const lines = [
        title,
        '='.repeat(60),
        `Unique: ${sorted.length}   Total: ${total}`,
        '',
        'Key'.padEnd(col1) + 'Count'.padStart(8) + '  ' + '%'.padStart(5),
        '-'.repeat(col1) + '  ' + '-'.repeat(8) + '  ' + '-'.repeat(5),
        ...sorted.map(([key, count]) => {
            const pct = ((count / total) * 100).toFixed(1);
            const display = key.length > 40 ? key.slice(0, 37) + '...' : key;
            return display.padEnd(col1) + String(count).padStart(8) + '  ' + pct.padStart(5) + '%';
        })
    ];
    vscode.workspace.openTextDocument({ content: lines.join('\n'), language: 'plaintext' })
        .then(d => vscode.window.showTextDocument(d, { preview: true }));
}

function deactivate() {}

module.exports = { activate, deactivate };
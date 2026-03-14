"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;

const vscode = require("vscode");

const SET_CONTEXT = "setContext";
const IS_ACTIVE_CONTEXT = "quickFind.isActive";
const FIND_LIMIT = 20000;

class QuickFind {
    constructor() {
    this.index = 0;
    this.matches = [];
    this.initialPosition = null;
    this.initialVisibleRange = null;
    this.cancelFlag = true;
    this.bookmarkPosition = null;
    this.bookmarkDecorationType = null;
    this.dimDecorationType = null;
    this.findOptions = { matchCase: false, wholeWord: false, visibleOnly: false };
    this.reset();
}

    expandToWord(range) {
    if (!this.editor) return range;
    const doc = this.editor.document;
    const wordRange = doc.getWordRangeAtPosition(range.start);
    if (wordRange && wordRange.contains(range)) {
        return wordRange;
    }
    return range;
}

    hide(cursorPosition = undefined) {
        this.exitMode = cursorPosition;
        if (cursorPosition) {
            this.cancelFlag = false;
        }
        if (this.inputBox) {
            this.inputBox.hide();
        }
    }

onHide() {
    console.log('onHide called, cancelFlag:', this.cancelFlag, 'initialPosition:', this.initialPosition);

    if (this.editor && this.cancelFlag && this.initialPosition) {
        console.log('Restoring to initial position:', this.initialPosition);
        this.editor.selections = [new vscode.Selection(this.initialPosition, this.initialPosition)];

        // Only center if position is outside visible bounds
        const range = new vscode.Range(this.initialPosition, this.initialPosition);
        let isVisible = false;
        for (const visibleRange of this.editor.visibleRanges) {
            if (visibleRange.contains(range)) {
                isVisible = true;
                break;
            }
        }

        if (!isVisible) {
            this.editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
        }
    } else if (this.editor && this.exitMode && this.exitMode !== 'cancel') {
        console.log('Setting cursor to', this.exitMode);
        const pos = this.exitMode === "left"
            ? this.editor.selections[0].start
            : this.editor.selections[0].end;
        this.editor.selections = [new vscode.Selection(pos, pos)];
    }

    vscode.commands.executeCommand(SET_CONTEXT, IS_ACTIVE_CONTEXT, false);
    this.cancelFlag = true;
    this.exitMode = undefined;
    this.removeDim();
    this.reset();
}

    dispose() {
        this.inputBox?.dispose();
        this.matchDecorationType?.dispose();
        this.activeMatchDecorationType?.dispose();
        this.bookmarkDecorationType?.dispose();
        this.dimDecorationType?.dispose();
    }

    reset() {
        this.index = 0;
        this.matches = [];
        this.editor?.setDecorations(this.matchDecorationType, []);
        this.editor?.setDecorations(this.activeMatchDecorationType, []);
    }

    applyDim() {
        this.dimDecorationType?.dispose();

        const config = vscode.workspace.getConfiguration('quickFind');
        const opacity = config.get('dimOpacity', 0.3);

        if (!this.editor || opacity >= 1) return;

        this.dimDecorationType = vscode.window.createTextEditorDecorationType({
            opacity: `${opacity}`
        });

        const fullRange = new vscode.Range(
            this.editor.document.positionAt(0),
            this.editor.document.positionAt(this.editor.document.getText().length)
        );
        this.editor.setDecorations(this.dimDecorationType, [fullRange]);
    }

    removeDim() {
        this.dimDecorationType?.dispose();
        this.dimDecorationType = null;
    }

    setBookmark(position) {
        this.bookmarkPosition = position;
        this.bookmarkDecorationType?.dispose();

        if (!this.editor) return;

        this.bookmarkDecorationType = vscode.window.createTextEditorDecorationType({
            gutterIconPath: vscode.Uri.parse(
                'data:image/svg+xml,' + encodeURIComponent(
                    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="4" fill="#007acc"/></svg>'
                )
            ),
            gutterIconSize: 'contain',
            overviewRulerLane: vscode.OverviewRulerLane.Full,
            overviewRulerColor: new vscode.ThemeColor("editor.wordHighlightStrongBorder")
        });

        const range = new vscode.Range(position, position);
        this.editor.setDecorations(this.bookmarkDecorationType, [range]);
    }

    jumpToBookmark() {
        if (!this.bookmarkPosition || !this.editor) return;

        this.editor.selections = [new vscode.Selection(this.bookmarkPosition, this.bookmarkPosition)];
        this.editor.revealRange(
            new vscode.Range(this.bookmarkPosition, this.bookmarkPosition),
            vscode.TextEditorRevealType.InCenter
        );
    }

    setMatches(matches, navigate = true) {
        this.matches = matches;
        const ranges = matches.map(m => m.range);
        this.editor?.setDecorations(this.matchDecorationType, ranges);

        if (!matches.length) {
            if (navigate) {
                this.setIndex(0);
            } else {
                this.index = 0;
                this.editor?.setDecorations(this.activeMatchDecorationType, []);
                if (this.inputBox) {
                    this.inputBox.prompt = this.inputBox.value ? "No results" : "Empty Lines  │  ⏎ type to search";
                }
            }
            return;
        }

        const active = this.editor.selections[0];
        if (!active) {
            if (navigate) { this.setIndex(0); } else { this.index = 0; }
            return;
        }

        const cursorPos = active.start;

        let nearestIdx = 0;
        let minDistance = Infinity;

        for (let i = 0; i < matches.length; i++) {
            const match = matches[i];
            const matchStart = match.range.start;

            let distance;
            if (matchStart.line === cursorPos.line) {
                distance = Math.abs(matchStart.character - cursorPos.character);
            } else {
                distance = Math.abs(matchStart.line - cursorPos.line) * 10000 +
                           Math.abs(matchStart.character - cursorPos.character);
            }

            if (distance < minDistance) {
                minDistance = distance;
                nearestIdx = i;
            }
        }

        if (navigate) {
            this.setIndex(nearestIdx);
        } else {
            this.index = nearestIdx;
            this.editor?.setDecorations(this.activeMatchDecorationType, []);
            const suffix = matches.length >= FIND_LIMIT ? "+" : "";
            if (this.inputBox) {
                this.inputBox.prompt = `${this.index + 1}/${this.matches.length}${suffix}  │  Empty Lines  │  ↑↓ to navigate`;
            }
        }
    }

    setIndex(i) {
        if (!this.inputBox) return;
        this.index = (i + this.matches.length) % this.matches.length;
        this.update();
    }

    goTop()    { this.matches.length && this.setIndex(0); }
    goBottom() { this.matches.length && this.setIndex(-1); }
    next()     { this.matches.length && this.setIndex(this.index + 1); }
    prev()     { this.matches.length && this.setIndex(this.index - 1); }

update() {
    if (!this.inputBox || !this.editor) return;
    if (this.matches.length === 0) {
        this.editor.setDecorations(this.activeMatchDecorationType, []);
        this.inputBox.prompt = this.inputBox.value ? "No results" : "Empty Lines  │  ⏎ type to search";
        return;
    }

    const cur = this.matches[this.index];
    const suffix = this.matches.length >= FIND_LIMIT ? "+" : "";

    const isEmptyLineMode = !this.inputBox.value;

    const caseFlag = this.findOptions.matchCase ? "🟢 Aa" : "🔴 Aa";
    const wordFlag = this.findOptions.wholeWord ? "🟢 W" : "🔴 W";
    const visFlag = this.findOptions.visibleOnly ? "🟢 Vis" : "🔴 Vis";

    if (isEmptyLineMode) {
        this.inputBox.prompt = `${this.index + 1}/${this.matches.length}${suffix}  │  Empty Lines`;
    } else {
        this.inputBox.prompt = `${this.index + 1}/${this.matches.length}${suffix}  │  ${caseFlag}  ${wordFlag}  ${visFlag}`;
    }

    this.editor.setDecorations(this.activeMatchDecorationType, [cur.range]);

    const sel = new vscode.Selection(cur.range.start, cur.range.end);
    this.editor.selections = [sel];

    const visibleRanges = this.editor.visibleRanges;
    let isVisible = false;
    for (const visibleRange of visibleRanges) {
        if (visibleRange.contains(cur.range)) {
            isVisible = true;
            break;
        }
    }

    if (!isVisible) {
        this.editor.revealRange(cur.range, vscode.TextEditorRevealType.InCenter);
    }
}

    findEmptyLines() {
        if (!this.editor) return [];
        const doc = this.editor.document;
        const out = [];
        const lineCount = doc.lineCount;

        for (let i = 0; i < lineCount && out.length < FIND_LIMIT; i++) {
            const line = doc.lineAt(i);
            if (line.text.trim() === '') {
                out.push({ value: '', range: line.range });
            }
        }
        return out;
    }

    async quickFind() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    this.editor = editor;

    this.initialPosition = editor.selection.active;
    this.initialVisibleRange = editor.visibleRanges[0];
    this.cancelFlag = true;

    this.setBookmark(this.initialPosition);

    const sel = editor.selection;
    let seed = '';
    let selectSeed = false;

    if (!sel.isEmpty) {
        seed = editor.document.getText(sel);
    } else {
        const wordRange = editor.document.getWordRangeAtPosition(editor.selection.active);
        if (wordRange) {
            seed = editor.document.getText(wordRange);
            selectSeed = true;
        }
    }

    this.matchDecorationType?.dispose();
    this.activeMatchDecorationType?.dispose();
    const bg  = new vscode.ThemeColor("editor.findMatchBackground");
    const bd  = new vscode.ThemeColor("editor.findMatchBorder");
    const hbg = new vscode.ThemeColor("editor.findMatchHighlightBackground");
    this.matchDecorationType = vscode.window.createTextEditorDecorationType({
        backgroundColor: hbg,
        opacity: "1",
        overviewRulerLane: vscode.OverviewRulerLane.Full,
        overviewRulerColor: hbg,
        gutterIconPath: vscode.Uri.parse(
        'data:image/svg+xml,' + encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><circle cx="8" cy="8" r="3" fill="#007acc"/></svg>'
        )
    ),
    gutterIconSize: 'contain',
    });
this.activeMatchDecorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: bg,
    border: `2px solid ${bd}`,
    borderRadius: '3px',
    opacity: "1",
});

    this.applyDim();

    this.inputBox = this.createInputBox(seed, "Quick Find in File");

    if (selectSeed && seed) {
        this.inputBox.valueSelection = [0, seed.length];
    }

    this.inputBox.show();
    vscode.commands.executeCommand(SET_CONTEXT, IS_ACTIVE_CONTEXT, true);

    if (seed) {
        const matches = this.find(seed);
        this.setMatches(matches);
    } else {
        const matches = this.findEmptyLines();
        this.setMatches(matches, false);
    }
}

    createInputBox(initialValue = '', promptText = '') {
        const ib = vscode.window.createInputBox();
        ib.placeholder = 'Quick Find';
        ib.prompt = promptText;
        ib.value = initialValue;
        ib.onDidChangeValue(v => {
            if (v) {
                const matches = this.find(v);
                this.setMatches(matches);
            } else {
                const matches = this.findEmptyLines();
                this.setMatches(matches, false);
            }
        });
        ib.onDidAccept(() => {
    this.cancelFlag = false;

    // Expand selection to whole word if configured
    const config = vscode.workspace.getConfiguration('quickFind');
    if (config.get('selectWholeWord', false) && this.matches.length > 0) {
        const cur = this.matches[this.index];
        const expandedRange = this.expandToWord(cur.range);
        this.editor.selections = [new vscode.Selection(expandedRange.start, expandedRange.end)];
    }

    ib.hide();
});;
        ib.onDidHide(() => this.onHide());
        return ib;
    }

    find(text) {
        if (!this.editor) return [];
        let pat = this.escapeRegExp(text);
        if (this.findOptions.wholeWord) {
            pat = `\\b${pat}\\b`;
        }
        const flags = this.findOptions.matchCase ? 'g' : 'gi';
        const re = new RegExp(pat, flags);

        const visibleOnly = this.findOptions.visibleOnly;

        const doc = this.editor.document;
        const out = [];
        let cnt = 0;

        if (visibleOnly) {
            for (const visibleRange of this.editor.visibleRanges) {
                const startOffset = doc.offsetAt(visibleRange.start);
                const endOffset = doc.offsetAt(visibleRange.end);
                const visibleText = doc.getText(visibleRange);
                let m;
                while (++cnt <= FIND_LIMIT && (m = re.exec(visibleText))) {
                    const r = new vscode.Range(
                        doc.positionAt(startOffset + m.index),
                        doc.positionAt(startOffset + m.index + m[0].length)
                    );
                    out.push({ value: m[0], range: r });
                }
            }
        } else {
            const fullText = doc.getText();
            let m;
            while (++cnt <= FIND_LIMIT && (m = re.exec(fullText))) {
                const r = new vscode.Range(
                    doc.positionAt(m.index),
                    doc.positionAt(m.index + m[0].length)
                );
                out.push({ value: m[0], range: r });
            }
        }
        return out;
    }

    escapeRegExp(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}

const quickFind = new QuickFind();

function activate(context) {
    console.log('JavQuickFind extension is now active!');

    context.subscriptions.push(
        vscode.commands.registerCommand('quickFind.toggleMatchCase', () => {
            quickFind.findOptions.matchCase = !quickFind.findOptions.matchCase;
            const matches = quickFind.find(quickFind.inputBox.value);
            quickFind.setMatches(matches);
        }),
        vscode.commands.registerCommand('quickFind.toggleWholeWord', () => {
            quickFind.findOptions.wholeWord = !quickFind.findOptions.wholeWord;
            const matches = quickFind.find(quickFind.inputBox.value);
            quickFind.setMatches(matches);
        }),
        vscode.commands.registerCommand('quickFind.toggleVisibleLinesOnly', () => {
            quickFind.findOptions.visibleOnly = !quickFind.findOptions.visibleOnly;
            const matches = quickFind.find(quickFind.inputBox.value);
            quickFind.setMatches(matches);
        }),
        vscode.commands.registerCommand('quickFind.find', () => {
            quickFind.quickFind();
        }),
        vscode.commands.registerCommand('quickFind.next', () => quickFind.next()),
        vscode.commands.registerCommand('quickFind.prev', () => quickFind.prev()),
        vscode.commands.registerCommand('quickFind.goTop', () => quickFind.goTop()),
        vscode.commands.registerCommand('quickFind.goBottom', () => quickFind.goBottom()),
        vscode.commands.registerCommand('quickFind.hide', () => quickFind.hide('cancel')),
        vscode.commands.registerCommand('quickFind.hideAndLeft', () => quickFind.hide('left')),
        vscode.commands.registerCommand('quickFind.hideAndRight', () => quickFind.hide('right')),
        vscode.commands.registerCommand('quickFind.jumpToBookmark', () => quickFind.jumpToBookmark())
    );

}
exports.activate = activate;

function deactivate() {
    quickFind.dispose();
    console.log('JavQuickFind extension is now deactivated!');
}
exports.deactivate = deactivate;
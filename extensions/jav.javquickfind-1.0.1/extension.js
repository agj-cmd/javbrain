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
        this.cancelFlag = true; // Assume cancel unless explicitly committed
        this.bookmarkPosition = null;
        this.bookmarkDecorationType = null;
        this.reset();
    }


    hide(cursorPosition = undefined) {
        this.exitMode = cursorPosition;
        if (cursorPosition) {
            this.cancelFlag = false; // User explicitly committed (left/right or cancel command)
        }
        if (this.inputBox) {
            this.inputBox.hide();
        }
    }

    onHide() {
        console.log('onHide called, cancelFlag:', this.cancelFlag, 'initialPosition:', this.initialPosition);
        
        // Restore position if cancelled (escape pressed, not accept/left/right)
        if (this.editor && this.cancelFlag && this.initialPosition) {
            console.log('Restoring to initial position:', this.initialPosition);
            this.editor.selections = [new vscode.Selection(this.initialPosition, this.initialPosition)];
            this.editor.revealRange(
                new vscode.Range(this.initialPosition, this.initialPosition),
                vscode.TextEditorRevealType.InCenter
            );
        } else if (this.editor && this.exitMode && this.exitMode !== 'cancel') {
            // For left/right, position cursor at start/end of current match
            console.log('Setting cursor to', this.exitMode);
            const pos = this.exitMode === "left"
                ? this.editor.selections[0].start
                : this.editor.selections[0].end;
            this.editor.selections = [new vscode.Selection(pos, pos)];
        }
        // If exitMode is undefined and cancelFlag is false (enter key), current selection is already correct
        
        vscode.commands.executeCommand(SET_CONTEXT, IS_ACTIVE_CONTEXT, false);
        this.cancelFlag = true; // Reset to true for next time
        this.exitMode = undefined;
        this.reset();
    }

    dispose() {
        this.inputBox?.dispose();
        this.matchDecorationType?.dispose();
        this.activeMatchDecorationType?.dispose();
        this.bookmarkDecorationType?.dispose();
    }

    reset() {
        this.index = 0;
        this.matches = [];
        this.editor?.setDecorations(this.matchDecorationType, []);
        this.editor?.setDecorations(this.activeMatchDecorationType, []);
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

    setMatches(matches) {
        this.matches = matches;
        const ranges = matches.map(m => m.range);
        this.editor?.setDecorations(this.matchDecorationType, ranges);

        if (!matches.length) {
            this.setIndex(0);
            return;
        }

        const active = this.editor.selections[0];
        if (!active) {
            this.setIndex(0);
            return;
        }

        const cursorPos = active.start;
        
        // Find the nearest match to the cursor position
        let nearestIdx = 0;
        let minDistance = Infinity;
        
        for (let i = 0; i < matches.length; i++) {
            const match = matches[i];
            const matchStart = match.range.start;
            
            // Calculate distance (prioritize same line, then by absolute character distance)
            let distance;
            if (matchStart.line === cursorPos.line) {
                // Same line: use absolute character difference
                distance = Math.abs(matchStart.character - cursorPos.character);
            } else {
                // Different line: use line difference (weighted heavily) + character offset
                distance = Math.abs(matchStart.line - cursorPos.line) * 10000 + 
                           Math.abs(matchStart.character - cursorPos.character);
            }
            
            if (distance < minDistance) {
                minDistance = distance;
                nearestIdx = i;
            }
        }
        
        this.setIndex(nearestIdx);
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
            this.inputBox.prompt = this.inputBox.value ? "No results" : "Quick Find in File";
            return;
        }

        const cur = this.matches[this.index];
        const suffix = this.matches.length >= FIND_LIMIT ? "+" : "";
        const caseFlag = this.findOptions.matchCase ? "[Aa]" : "[aa]";
        const wordFlag = this.findOptions.wholeWord ? "[W]" : "";
        this.inputBox.prompt = `${this.index + 1} of ${this.matches.length}${suffix}  ${caseFlag} ${wordFlag}`;

        this.editor.setDecorations(this.activeMatchDecorationType, [cur.range]);
        
        const sel = new vscode.Selection(cur.range.start, cur.range.end);
        this.editor.selections = [sel];
        
        // Only scroll if match is outside visible range
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

    async quickFind() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;
        this.editor = editor;

        // Store initial position for cancel restoration
        this.initialPosition = editor.selection.active;
        this.initialVisibleRange = editor.visibleRanges[0];
        this.cancelFlag = true; // Default to cancel unless explicitly committed

        // Set bookmark at current position before activating
        this.setBookmark(this.initialPosition);

        const sel = editor.selection;
        let seed = '';
        if (!sel.isEmpty) {
            seed = editor.document.getText(sel);
        }

        this.matchDecorationType?.dispose();
        this.activeMatchDecorationType?.dispose();
        const bg  = new vscode.ThemeColor("editor.findMatchBackground");
        const bd  = new vscode.ThemeColor("editor.findMatchBorder");
        const hbg = new vscode.ThemeColor("editor.findMatchHighlightBackground");
        this.matchDecorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: hbg,
            overviewRulerLane: vscode.OverviewRulerLane.Full,
            overviewRulerColor: hbg
        });
        this.activeMatchDecorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: bg,
            border: `2px solid ${bd}`
        });

        this.findOptions = { matchCase: false, wholeWord: false };

        this.inputBox = this.createInputBox(seed, "Quick Find in File");
        this.inputBox.show();
        vscode.commands.executeCommand(SET_CONTEXT, IS_ACTIVE_CONTEXT, true);

        if (seed) {
            const matches = this.find(seed);
            this.setMatches(matches);
        }
    }

    createInputBox(initialValue = '', promptText = '') {
        const ib = vscode.window.createInputBox();
        ib.placeholder = 'Quick Find';
        ib.prompt = promptText;
        ib.value = initialValue;
        ib.onDidChangeValue(v => {
            const matches = this.find(v);
            this.setMatches(v ? matches : []);
        });
        ib.onDidAccept(() => {
            this.cancelFlag = false; // Enter pressed - commit position
            ib.hide();
        });
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
        const doc = this.editor.document.getText();
        const out = [];
        let cnt = 0, m;
        while (++cnt <= FIND_LIMIT && (m = re.exec(doc))) {
            const r = new vscode.Range(
                this.editor.document.positionAt(m.index),
                this.editor.document.positionAt(m.index + m[0].length)
            );
            out.push({ value: m[0], range: r });
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
    
    // Show activation message
    vscode.window.showInformationMessage('JavQuickFind is ready! Use Ctrl+F to search.');
}
exports.activate = activate;

function deactivate() {
    quickFind.dispose();
    console.log('JavQuickFind extension is now deactivated!');
}
exports.deactivate = deactivate;
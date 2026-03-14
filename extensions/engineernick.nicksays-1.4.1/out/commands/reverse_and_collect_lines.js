"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reverse_and_collect_lines = void 0;
const vscode_1 = require("vscode");
/**
 * Reverse lines then remove newline characters
 */
function reverse_and_collect_lines(editor, edit, ...args) {
    // Sort selections in reverse order based on their start line
    const selections = editor.selections.sort((a, b) => b.start.line - a.start.line);
    for (let selection of selections) {
        let selection_lines = new vscode_1.Range(editor.document.lineAt(selection.start.line).range.start, editor.document.lineAt(selection.end.line).range.end);
        let range_texts = [];
        for (let i = selection_lines.start.line; i <= selection_lines.end.line; i++) {
            range_texts.push(editor.document.lineAt(i).text);
        }
        range_texts.reverse();
        edit.replace(selection_lines, range_texts.join(""));
    }
}
exports.reverse_and_collect_lines = reverse_and_collect_lines;
//# sourceMappingURL=reverse_and_collect_lines.js.map
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.expand_to_next_occurrence = exports.seek_to_next_occurrence = void 0;
const vscode = require("vscode");
const { showInputBox, showErrorMessage } = vscode.window;
let last_seek_expand_value = "";
function seek_to_next_occurrence(editor, edit, ...args) {
    return __awaiter(this, void 0, void 0, function* () {
        const search_string = yield vscode.window.showInputBox({
            placeHolder: "characters to search for",
            prompt: "Move cursors forward to the next occurrence of a search string on a line. Move to end if none found.",
            value: last_seek_expand_value,
        });
        if (search_string === "" || search_string === undefined) {
            vscode.window.showErrorMessage('A character string is required, cursors have not been moved');
            return;
        }
        last_seek_expand_value = search_string;
        let new_selections = [];
        for (let selection of editor.selections) {
            let text_line = editor.document.lineAt(selection.end.line);
            let offset = text_line.text.slice(selection.end.character).indexOf(search_string);
            let new_position;
            if (offset === -1) {
                new_position = editor.document.lineAt(selection.end.line).range.end;
            }
            else {
                new_position = selection.end.translate(0, offset);
            }
            new_selections.push(new vscode.Selection(new_position, new_position));
        }
        editor.selections = new_selections;
    });
}
exports.seek_to_next_occurrence = seek_to_next_occurrence;
function expand_to_next_occurrence(editor, edit, ...args) {
    return __awaiter(this, void 0, void 0, function* () {
        const search_string = yield vscode.window.showInputBox({
            placeHolder: "characters to search for",
            prompt: "Expand selection forward from cursors to the next occurrence of a search string on a line. Move to end if none found.",
            value: last_seek_expand_value,
        });
        if (search_string === "" || search_string === undefined) {
            vscode.window.showErrorMessage('A character string is required, cursors have not been moved');
            return;
        }
        last_seek_expand_value = search_string;
        let new_selections = [];
        for (let selection of editor.selections) {
            let text_line = editor.document.lineAt(selection.end.line);
            let offset = text_line.text.slice(selection.end.character).indexOf(search_string);
            if (offset === -1) {
                new_selections.push(new vscode.Selection(selection.start, editor.document.lineAt(selection.end.line).range.end));
            }
            else {
                new_selections.push(new vscode.Selection(selection.start, selection.end.translate(0, offset)));
            }
        }
        editor.selections = new_selections;
    });
}
exports.expand_to_next_occurrence = expand_to_next_occurrence;
//# sourceMappingURL=seek_selections.js.map
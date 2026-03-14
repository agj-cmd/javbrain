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
exports.identify = exports.identifyCharacters = void 0;
const vscode_1 = require("vscode");
const config_1 = require("../config");
const data_1 = require("../data");
const code_conversion_1 = require("../utility/code-conversion");
const identifyCharacters = (editor) => __awaiter(void 0, void 0, void 0, function* () {
    const text = editor.selection.isEmpty ?
        yield vscode_1.window.showInputBox({ prompt: 'Characters to identify.' }) :
        editor.document.getText(editor.selection);
    if (text === undefined)
        return;
    const message = identify(text)
        .map(item => item.entry === undefined
        ? `Unknown character code: ${(0, code_conversion_1.codesToHex)([item.code])}`
        : `${item.char}: ${item.entry.name} (${(0, code_conversion_1.codesToHex)([item.code])})`)
        .join('\n');
    let showFile = config_1.Config.section.get('show-identified-characters-in-file');
    if (showFile === false)
        showFile = (yield vscode_1.window.showInformationMessage(message, 'Show in New File')) !== undefined;
    if (showFile) {
        const document = yield vscode_1.workspace.openTextDocument({
            content: message,
        });
        yield vscode_1.window.showTextDocument(document, vscode_1.ViewColumn.Two);
    }
});
exports.identifyCharacters = identifyCharacters;
/**
 * Identifies Unicode characters of a string.
 * @param text The text whose characters should be identified.
 * @returns
 *     List of characters and their Unicode entries.
 *     `entry` is `undefined` if it could not be found.
 */
function identify(text) {
    return Array.from(text)
        .map(char => ({
        char,
        code: char.codePointAt(0) ? char.codePointAt(0) : char.charCodeAt(0)
    }))
        .map(item => (Object.assign(Object.assign({}, item), { entry: data_1.data.find(d => d.codes.length === 1 && d.codes[0] === item.code) })));
}
exports.identify = identify;
//# sourceMappingURL=identify-characters.js.map
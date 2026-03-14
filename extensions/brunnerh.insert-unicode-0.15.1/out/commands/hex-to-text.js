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
exports.hexToText = void 0;
const vscode_1 = require("vscode");
const data_1 = require("../data");
const editor_1 = require("../utility/editor");
const code_conversion_1 = require("../utility/code-conversion");
const findEntry = (search) => data_1.data.find(item => item.codes.length === 1 && item.codes[0] === parseInt(search, 16));
const hexToText = (editor) => __awaiter(void 0, void 0, void 0, function* () {
    const code = yield vscode_1.window.showInputBox({
        placeHolder: 'e.g. "1f525" for the FIRE Unicode character.',
        validateInput: value => value.match(/^[0-9a-f]*$/i) === null ? 'Input does not match number in hexadecimal.' :
            findEntry(value) === undefined ? 'No character exists for this hex code.' : null,
    });
    if (code === undefined)
        return;
    const entry = findEntry(code);
    yield (0, editor_1.insert)(editor, entry, (0, code_conversion_1.codesToText)(entry.codes));
});
exports.hexToText = hexToText;
//# sourceMappingURL=hex-to-text.js.map
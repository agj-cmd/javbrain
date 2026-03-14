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
exports.insertFont = void 0;
const vscode_1 = require("vscode");
const config_1 = require("../config");
const insertFont = (editor, edit, ...args) => __awaiter(void 0, void 0, void 0, function* () {
    var fontStyle = args[0];
    const spaceCode = ' '.charCodeAt(0);
    const ACode = 'A'.charCodeAt(0);
    const aCode = 'a'.charCodeAt(0);
    const ZCode = 'Z'.charCodeAt(0);
    const zCode = 'z'.charCodeAt(0);
    const d0Code = '0'.charCodeAt(0);
    const d9Code = '9'.charCodeAt(0);
    const enSpace = 0x2002;
    const emSpace = 0x2003;
    // Characters that have been defined earlier are missing and need to me re-mapped.
    const holes = {
        0x1d455: 0x210e,
        0x1d4ba: 0x212f,
        0x1d4bc: 0x210a,
        0x1d4c4: 0x2134,
        0x1d49d: 0x212c,
        0x1d4a0: 0x2130,
        0x1d4a1: 0x2131,
        0x1d4a3: 0x210b,
        0x1d4a4: 0x2110,
        0x1d4a7: 0x2112,
        0x1d4a8: 0x2133,
        0x1d4ad: 0x211b,
        0x1d506: 0x212d,
        0x1d50b: 0x210c,
        0x1d50c: 0x2111,
        0x1d515: 0x211c,
        0x1d51d: 0x2128,
        0x1d53a: 0x2102,
        0x1d53f: 0x210d,
        0x1d545: 0x2115,
        0x1d547: 0x2119,
        0x1d548: 0x211a,
        0x1d549: 0x211d,
        0x1d551: 0x2124, // MATHEMATICAL DOUBLE-STRUCK CAPITAL Z -> DOUBLE-STRUCK CAPITAL Z
    };
    const fontStyles = [
        { label: "Math Bold", A: 0x1D400, a: 0x1D41A, zero: 0x1D7CE, space: spaceCode },
        { label: "Math Italic", A: 0x1D434, a: 0x1D44E, space: spaceCode },
        { label: "Math Bold Italic", A: 0x1D468, a: 0x1D482, space: spaceCode },
        { label: "Math Script", A: 0x1D49C, a: 0x1D4B6, space: spaceCode },
        { label: "Math Script Bold", A: 0x1D4D0, a: 0x1D4EA, space: enSpace },
        { label: "Math Fraktur", A: 0x1D504, a: 0x1D51E, space: spaceCode },
        { label: "Math Fraktur Bold", A: 0x1D56C, a: 0x1D586, space: enSpace },
        { label: "Math Double-Struck", A: 0x1D538, a: 0x1D552, zero: 0x1D7D8, space: enSpace },
        { label: "Math Sans-Serif", A: 0x1D5A0, a: 0x1D5BA, zero: 0x1D7E2, space: spaceCode },
        { label: "Math Sans-Serif Bold", A: 0x1D5D4, a: 0x1D5EE, zero: 0x1D7EC, space: spaceCode },
        { label: "Math Sans-Serif Italic", A: 0x1D608, a: 0x1D622, space: spaceCode },
        { label: "Math Sans-Serif Bold Italic", A: 0x1D63C, a: 0x1D656, space: spaceCode },
        { label: "Math Monospace", A: 0x1D670, a: 0x1D68A, zero: 0x1D7F6, space: spaceCode },
        { label: "Squared Latin", A: 0x1F130, space: emSpace },
        { label: "Negative Circled Latin", A: 0x1F150, space: emSpace },
        { label: "Negative Squared Latin", A: 0x1F170, space: emSpace },
    ];
    const convertText = (text, style) => {
        const spaceReplacement = config_1.Config.section.get("unicode-font-use-regular-space") ?
            spaceCode : style.space;
        return text
            .split('')
            .map(e => {
            const c = e.charCodeAt(0);
            if (c === spaceCode)
                return spaceReplacement;
            // Capitals
            if (c >= ACode && c <= ZCode)
                return c - ACode + style.A;
            // Small (with fallback to caps)
            if (c >= aCode && c <= zCode)
                return (c - aCode + (style.a === undefined ? style.A : style.a));
            // Digits
            if (c >= d0Code && c <= d9Code && style.zero !== undefined)
                return c - d0Code + style.zero;
            return c;
        })
            .map(c => String.fromCodePoint(c in holes ? holes[c] : c))
            .join('');
    };
    const pickStyle = () => __awaiter(void 0, void 0, void 0, function* () {
        const item = yield vscode_1.window.showQuickPick(fontStyles.map(style => ({
            label: convertText(style.label, style),
            description: style.label,
            style: style
        })), {
            matchOnDescription: true
        });
        return item === undefined ? undefined : item.style;
    });
    const insert = (style) => __awaiter(void 0, void 0, void 0, function* () {
        if (editor.selection.isEmpty) {
            const text = yield vscode_1.window.showInputBox({
                prompt: "Text to insert."
            });
            if (text === undefined)
                return;
            const insertText = convertText(text, style);
            editor.edit(edit => edit.insert(editor.selection.start, insertText));
        }
        else {
            const text = editor.document.getText(editor.selection);
            const replacementText = convertText(text, style);
            editor.edit(edit => edit.replace(editor.selection, replacementText));
        }
    });
    let style;
    if (typeof fontStyle === 'string') {
        style = fontStyles.filter(style => style.label === fontStyle)[0];
        if (style === undefined) {
            vscode_1.window.showErrorMessage(`Unknown font style argument: ${fontStyle}.\nKnown styles: ${fontStyles.map(s => s.label).join(", ")}`);
            return;
        }
    }
    else {
        const selection = yield pickStyle();
        if (selection === undefined)
            return;
        style = selection;
    }
    yield insert(style);
});
exports.insertFont = insertFont;
//# sourceMappingURL=insert-font.js.map
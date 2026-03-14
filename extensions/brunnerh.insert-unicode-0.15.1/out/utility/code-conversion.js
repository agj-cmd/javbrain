"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.codesToText = exports.codesToDecimal = exports.codesToHex = void 0;
const codesToHex = (codes) => codes.map(code => `0x${code.toString(16)}`).join(' ');
exports.codesToHex = codesToHex;
const codesToDecimal = (codes) => codes.map(code => code.toString(10)).join(' ');
exports.codesToDecimal = codesToDecimal;
const codesToText = (codes) => String.fromCodePoint(...codes);
exports.codesToText = codesToText;
//# sourceMappingURL=code-conversion.js.map
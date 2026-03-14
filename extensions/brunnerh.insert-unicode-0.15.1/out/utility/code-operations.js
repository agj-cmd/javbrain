"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isEmoji = exports.isSkinToneModifier = void 0;
const data_1 = require("../data");
/** Indicates whether a code point is a skin tone modifier. */
const isSkinToneModifier = (code) => code >= 0x1f3fb && code <= 0x1f3ff;
exports.isSkinToneModifier = isSkinToneModifier;
const codesSet = new Set(data_1.emoji
    .filter(e => e.type == 'fully-qualified')
    .map(e => e.codes.join(',')));
/** Indicates whether code points refer to an emoji. */
const isEmoji = (codes) => codesSet.has(codes.join(','));
exports.isEmoji = isEmoji;
//# sourceMappingURL=code-operations.js.map
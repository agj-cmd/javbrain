"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sleep = exports.leftPad = exports.toDisposable = void 0;
function toDisposable(dispose) {
    return { dispose };
}
exports.toDisposable = toDisposable;
function leftPad(value, size, char = " ") {
    const chars = char.repeat(size);
    const paddedNumber = `${chars}${value}`.substr(-chars.length);
    return paddedNumber;
}
exports.leftPad = leftPad;
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
exports.sleep = sleep;
//# sourceMappingURL=util.js.map
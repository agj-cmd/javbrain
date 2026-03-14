"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function number_cursors_from_one(editor, edit, ...args) {
    let num = 1;
    for (let selection of editor.selections) {
        edit.replace(selection, num.toString());
        num++;
    }
}
exports.default = number_cursors_from_one;
//# sourceMappingURL=number_cursors_from_one.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.right_align_cursors_using_spaces = exports.left_align_cursors_using_spaces = void 0;
const get_column_1 = require("../get_column");
function left_align_cursors_using_spaces(editor, edit, ...args) {
    let max_column = 0;
    for (let selection of editor.selections) {
        max_column = Math.max(max_column, get_column_1.get_column(editor, selection.start));
    }
    for (let selection of editor.selections) {
        edit.insert(selection.start, ''.padEnd(max_column - get_column_1.get_column(editor, selection.start)));
    }
}
exports.left_align_cursors_using_spaces = left_align_cursors_using_spaces;
function right_align_cursors_using_spaces(editor, edit, ...args) {
    let max_column = 0;
    let max_width = 0;
    for (let selection of editor.selections) {
        max_column = Math.max(max_column, get_column_1.get_column(editor, selection.start));
        max_width = Math.max(max_width, get_column_1.get_column(editor, selection.end) - get_column_1.get_column(editor, selection.start));
    }
    for (let selection of editor.selections) {
        let selection_width = get_column_1.get_column(editor, selection.end) - get_column_1.get_column(editor, selection.start);
        edit.insert(selection.start, ''.padEnd(max_column - get_column_1.get_column(editor, selection.start) + max_width - selection_width));
    }
}
exports.right_align_cursors_using_spaces = right_align_cursors_using_spaces;
//# sourceMappingURL=align_cursors.js.map
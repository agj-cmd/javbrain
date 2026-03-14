"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.get_column = void 0;
function get_column(editor, position) {
    const tab_size = editor.options.tabSize;
    const tab_char = "\t";
    let text_line = editor.document.lineAt(position.line);
    let column = 0;
    for (let character of text_line.text.slice(0, position.character)) {
        if (character === tab_char) {
            if (column % tab_size === 0) {
                column += tab_size;
            }
            else {
                column += tab_size - column % tab_size;
            }
        }
        else {
            column += 1;
        }
    }
    return column;
}
exports.get_column = get_column;
//# sourceMappingURL=get_column.js.map
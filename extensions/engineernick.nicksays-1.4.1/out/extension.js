"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
const number_cursors_1 = require("./commands/number_cursors");
const align_cursors_1 = require("./commands/align_cursors");
const seek_selections_1 = require("./commands/seek_selections");
const insert_line_above_sticky_1 = require("./commands/insert_line_above_sticky");
const reverse_and_collect_lines_1 = require("./commands/reverse_and_collect_lines");
let registerTextEditorCommand = vscode.commands.registerTextEditorCommand;
function activate(context) {
    let register_and_subscribe = (command_name, command_function) => {
        let disposable = registerTextEditorCommand(command_name, command_function);
        context.subscriptions.push(disposable);
        return disposable;
    };
    register_and_subscribe('engineernick.multi-cursor-tools.number_cursors_from_zero', number_cursors_1.number_cursors_from_zero);
    register_and_subscribe('engineernick.multi-cursor-tools.number_cursors_from_one', number_cursors_1.number_cursors_from_one);
    register_and_subscribe('engineernick.multi-cursor-tools.number_cursors_from_arbitrary', number_cursors_1.number_cursors_from_arbitrary);
    register_and_subscribe('engineernick.multi-cursor-tools.number_cursors_from_arbitrary_with_step', number_cursors_1.number_cursors_from_arbitrary_with_step);
    register_and_subscribe('engineernick.multi-cursor-tools.left_align_cursors_using_spaces', align_cursors_1.left_align_cursors_using_spaces);
    register_and_subscribe('engineernick.multi-cursor-tools.right_align_cursors_using_spaces', align_cursors_1.right_align_cursors_using_spaces);
    register_and_subscribe('engineernick.multi-cursor-tools.seek_to_next_occurrence', seek_selections_1.seek_to_next_occurrence);
    register_and_subscribe('engineernick.multi-cursor-tools.expand_to_next_occurrence', seek_selections_1.expand_to_next_occurrence);
    register_and_subscribe('engineernick.multi-cursor-tools.insert_line_above_sticky', insert_line_above_sticky_1.insert_line_above_sticky);
    register_and_subscribe('engineernick.multi-cursor-tools.reverse_and_collect_lines', reverse_and_collect_lines_1.reverse_and_collect_lines);
}
exports.activate = activate;
function deactivate() {
    // pass
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map
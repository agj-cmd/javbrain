"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.number_cursors_from_arbitrary_with_step = exports.number_cursors_from_arbitrary = exports.number_cursors_from_zero = exports.number_cursors_from_one = void 0;
const vscode = require("vscode");
const { showInputBox, showErrorMessage } = vscode.window;
function number_cursors_from_one(editor, edit, ...args) {
    let num = 1;
    for (let selection of editor.selections) {
        edit.replace(selection, num.toString());
        num++;
    }
}
exports.number_cursors_from_one = number_cursors_from_one;
function number_cursors_from_zero(editor, edit, ...args) {
    let num = 0;
    for (let selection of editor.selections) {
        edit.replace(selection, num.toString());
        num++;
    }
}
exports.number_cursors_from_zero = number_cursors_from_zero;
function number_cursors_from_arbitrary(editor, edit, ...args) {
    showInputBox({
        placeHolder: "1",
        prompt: "Starting number",
        value: "1"
    }).then(user_input => {
        if (user_input === undefined || user_input === "") {
            showErrorMessage('A number was required. No change made.');
            return;
        }
        let num = parseFloat(user_input);
        if (Math.abs(num) >= Number.MAX_SAFE_INTEGER) {
            showErrorMessage('Number too big. No change made.');
            return;
        }
        if (!(num.toString() === user_input)) {
            showErrorMessage('Wrong number format. No change made.');
            return;
        }
        editor.edit((edit) => {
            for (let selection of editor.selections) {
                edit.replace(selection, num.toString());
                num++;
            }
        });
    });
}
exports.number_cursors_from_arbitrary = number_cursors_from_arbitrary;
function number_cursors_from_arbitrary_with_step(editor, edit, ...args) {
    showInputBox({
        placeHolder: "1",
        prompt: "Starting number",
        value: "1"
    }).then(user_input => {
        if (user_input === undefined || user_input === "") {
            showErrorMessage('A number was required. No change made.');
            return;
        }
        let num = parseFloat(user_input);
        if (Math.abs(num) >= Number.MAX_SAFE_INTEGER) {
            showErrorMessage('Number too big. No change made.');
            return;
        }
        if (!(num.toString() === user_input)) {
            showErrorMessage('Wrong number format. No change made.');
            return;
        }
        showInputBox({
            placeHolder: "1",
            prompt: "Steps",
            value: "1"
        }).then(user_input_step => {
            if (user_input_step === undefined || user_input_step === "") {
                showErrorMessage('A number was required. No change made.');
                return;
            }
            const step = parseFloat(user_input_step);
            if (Math.abs(step) >= Number.MAX_SAFE_INTEGER) {
                showErrorMessage('Number too big. No change made.');
                return;
            }
            if (!(step.toString() === user_input_step)) {
                showErrorMessage('Wrong number format. No change made.');
                return;
            }
            editor.edit((edit) => {
                for (let selection of editor.selections) {
                    edit.replace(selection, num.toString());
                    num += step;
                }
            });
        });
    });
}
exports.number_cursors_from_arbitrary_with_step = number_cursors_from_arbitrary_with_step;
//# sourceMappingURL=number_cursors.js.map
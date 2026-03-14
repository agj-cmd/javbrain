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
exports.makeErrorSerializable = exports.showIssueError = void 0;
const vscode_1 = require("vscode");
const context_1 = require("../context");
/**
 *
 * @param message The messsage of the error.
 * @param issueData Information to show in the issue.
 * @param otherItems Other buttons to show.
 * @returns `null` if no selection was made or the issue link was selected.
 */
function showIssueError(message, issueData, ...otherItems) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const issueItem = { title: 'Open Issue' };
        const items = [...otherItems, issueItem];
        const selection = yield vscode_1.window.showErrorMessage(message, ...items);
        if (selection === issueItem) {
            let errorInfo = null;
            try {
                errorInfo = JSON.stringify(issueData.errorInfo, undefined, '  ');
            }
            catch (_b) { }
            // https://docs.github.com/en/issues/tracking-your-work-with-issues/creating-issues/about-automation-for-issues-and-pull-requests-with-query-parameters
            const url = new URL(context_1.Context.current.extension.packageJSON.homepage + '/issues/new');
            url.searchParams.set('title', (_a = issueData.title) !== null && _a !== void 0 ? _a : '');
            url.searchParams.set('body', errorInfo === null ? '' : [
                '<!-- Please review the error information and remove anything sensitive. -->',
                '',
                '<details>',
                '<summary>Error Info</summary>',
                '',
                '```json',
                errorInfo,
                '```',
                '</details>'
            ].join('\n'));
            vscode_1.env.openExternal(vscode_1.Uri.parse(url.toString()));
            return null;
        }
        return selection;
    });
}
exports.showIssueError = showIssueError;
/**
 * Makes an error JSON serializable.
 * @param error The error.
 * @returns The error.
 */
function makeErrorSerializable(error) {
    Object.defineProperty(error, 'toJSON', {
        value() {
            const self = this;
            const record = {};
            Object.getOwnPropertyNames(self)
                .forEach(key => record[key] = self[key]);
            if (error instanceof Error) {
                if ('stack' in record && record.stack != null)
                    record.stack = record.stack.split('\n');
            }
            return record;
        },
        configurable: true,
        writable: true
    });
    return error;
}
exports.makeErrorSerializable = makeErrorSerializable;
//# sourceMappingURL=messages.js.map
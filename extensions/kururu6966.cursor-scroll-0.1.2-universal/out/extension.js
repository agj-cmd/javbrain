"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = __importStar(require("vscode"));
const activate = (context) => {
    const centerCommand = vscode.commands.registerCommand('scroll-position.center', () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const lineNumber = editor.selection.active.line;
            vscode.commands.executeCommand('revealLine', {
                lineNumber,
                at: 'center'
            });
        }
    });
    const topCommand = vscode.commands.registerCommand('scroll-position.top', () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const lineNumber = editor.selection.active.line;
            vscode.commands.executeCommand('revealLine', {
                lineNumber,
                at: 'top'
            });
        }
    });
    const bottomCommand = vscode.commands.registerCommand('scroll-position.bottom', () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const lineNumber = editor.selection.active.line;
            vscode.commands.executeCommand('revealLine', {
                lineNumber,
                at: 'bottom'
            });
        }
    });
    context.subscriptions.push(centerCommand, topCommand, bottomCommand);
};
exports.activate = activate;
const deactivate = () => { };
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map
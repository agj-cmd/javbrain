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
exports.ClipboardCompletion = void 0;
const vscode = __importStar(require("vscode"));
const common_1 = require("./commads/common");
const util_1 = require("./util");
class ClipboardCompletion {
    constructor(manager) {
        this.manager = manager;
    }
    provideCompletionItems(document, _position, _token, _context) {
        const config = vscode.workspace.getConfiguration("clipboard-manager", document.uri);
        const enabled = config.get("snippet.enabled", true);
        if (!enabled) {
            return null;
        }
        const prefix = config.get("snippet.prefix", "clip");
        const maxSnippets = config.get("snippet.max", 10);
        const clips = maxSnippets > 0
            ? this.manager.clips.slice(0, maxSnippets)
            : this.manager.clips;
        const maxLength = `${clips.length}`.length;
        const completions = clips.map((clip, index) => {
            // Add left zero pad from max number of clips
            const indexNumber = (0, util_1.leftPad)(index + 1, maxLength, "0");
            const c = {
                label: `${prefix}${indexNumber}`,
                detail: `Clipboard ${indexNumber}`,
                insertText: clip.value,
                kind: vscode.CompletionItemKind.Text,
                filterText: `${prefix}${indexNumber} ${clip.value}`,
            };
            // Highlight the syntax of clip
            c.documentation = new vscode.MarkdownString();
            c.documentation.appendCodeblock(clip.value, clip.language);
            if (clip.createdAt) {
                const date = new Date(clip.createdAt);
                c.detail += " - " + date.toLocaleString();
            }
            c.command = {
                command: common_1.commandList.setClipboardValue,
                title: "Paste",
                tooltip: "Paste",
                arguments: [clip.value],
            };
            return c;
        });
        return completions;
    }
}
exports.ClipboardCompletion = ClipboardCompletion;
//# sourceMappingURL=completion.js.map
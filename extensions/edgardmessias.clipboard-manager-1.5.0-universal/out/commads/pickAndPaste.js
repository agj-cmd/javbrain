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
exports.PickAndPasteCommand = void 0;
const vscode = __importStar(require("vscode"));
const util_1 = require("../util");
const common_1 = require("./common");
class ClipPickItem {
    get description() {
        if (this.clip.createdAt) {
            const date = new Date(this.clip.createdAt);
            return date.toLocaleString();
        }
    }
    constructor(clip) {
        this.clip = clip;
        this.label = this.clip.value.replace(/\s+/g, " ").trim();
    }
}
class PickAndPasteCommand {
    constructor(_manager) {
        this._manager = _manager;
        this._disposable = [];
        this._disposable.push(vscode.commands.registerCommand(common_1.commandList.pickAndPaste, this.execute, this));
    }
    execute() {
        return __awaiter(this, void 0, void 0, function* () {
            const config = vscode.workspace.getConfiguration("clipboard-manager");
            const preview = config.get("preview", true);
            const clips = this._manager.clips;
            const maxLength = `${clips.length}`.length;
            const picks = clips.map((c, index) => {
                const item = new ClipPickItem(c);
                const indexNumber = (0, util_1.leftPad)(index + 1, maxLength, "0");
                item.label = `${indexNumber}) ${item.label}`;
                return item;
            });
            // Variable to check changes in document by preview
            let needUndo = false;
            const options = {
                placeHolder: "Select one clip to paste. ESC to cancel.",
            };
            /**
             * If preview is enabled, get current text editor and replace
             * current selecion.
             * NOTE: not need paste if the text is replaced
             */
            if (preview) {
                options.onDidSelectItem = (selected) => __awaiter(this, void 0, void 0, function* () {
                    const editor = vscode.window.activeTextEditor;
                    if (editor) {
                        const replace = () => editor.edit(edit => {
                            for (const selection of editor.selections) {
                                edit.replace(selection, selected.clip.value);
                            }
                            needUndo = true;
                        }, {
                            undoStopAfter: false,
                            undoStopBefore: false,
                        });
                        const selections = [];
                        if (editor.selections.every(s => s.isEmpty)) {
                            editor
                                .edit(edit => {
                                for (const selection of editor.selections) {
                                    edit.insert(selection.start, " ");
                                    selections.push(new vscode.Selection(selection.start.line, selection.start.character, selection.start.line, selection.start.character + 1));
                                }
                            }, {
                                undoStopAfter: false,
                                undoStopBefore: false,
                            })
                                .then(() => {
                                if (selections.length > 0) {
                                    editor.selections = selections;
                                }
                            })
                                .then(replace);
                        }
                        else {
                            replace();
                        }
                    }
                });
            }
            const pick = yield vscode.window.showQuickPick(picks, options);
            if (!pick) {
                if (needUndo) {
                    return yield vscode.commands.executeCommand("undo");
                }
                return;
            }
            // Update current clip in clipboard
            yield this._manager.setClipboardValue(pick.clip.value);
            // If text changed, only need remove selecion
            // If a error occur on replace, run paste command for fallback
            if (needUndo) {
                // Fix editor selection
                const editor = vscode.window.activeTextEditor;
                if (editor) {
                    const selecions = editor.selections.map(s => new vscode.Selection(s.end, s.end));
                    editor.selections = selecions;
                }
                else {
                    return yield vscode.commands.executeCommand("cancelSelection");
                }
            }
            else {
                return yield vscode.commands.executeCommand("editor.action.clipboardPasteAction");
            }
        });
    }
    dispose() {
        this._disposable.forEach(d => d.dispose());
    }
}
exports.PickAndPasteCommand = PickAndPasteCommand;
//# sourceMappingURL=pickAndPaste.js.map
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
exports.HistoryTreeDoubleClickCommand = void 0;
const vscode = __importStar(require("vscode"));
const common_1 = require("./common");
/**
 * Command to paste from double click on history item
 */
class HistoryTreeDoubleClickCommand {
    constructor(_manager) {
        this._manager = _manager;
        this._disposable = [];
        this.prevTime = Date.now();
        this._disposable.push(vscode.commands.registerCommand(common_1.commandList.historyTreeDoubleClick, this.execute, this));
    }
    /**
     * Emulate double click on tree view history
     * @param clip
     */
    execute(clip) {
        return __awaiter(this, void 0, void 0, function* () {
            const now = Date.now();
            if (this.prevClip !== clip) {
                this.prevClip = clip;
                this.prevTime = now;
                return;
            }
            const diff = now - this.prevTime;
            this.prevTime = now;
            if (diff > 500) {
                return;
            }
            // Reset double click
            this.prevClip = undefined;
            // Update current clip in clipboard
            yield this._manager.setClipboardValue(clip.value);
            // Force to focus on editor to paste command works
            yield vscode.commands.executeCommand("workbench.action.focusActiveEditorGroup");
            // Run default paste
            return yield vscode.commands.executeCommand("editor.action.clipboardPasteAction");
        });
    }
    dispose() {
        this._disposable.forEach(d => d.dispose());
    }
}
exports.HistoryTreeDoubleClickCommand = HistoryTreeDoubleClickCommand;
//# sourceMappingURL=historyTreeDoubleClick.js.map
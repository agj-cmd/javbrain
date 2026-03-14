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
exports.ShowClipboardInFile = void 0;
const vscode = __importStar(require("vscode"));
const common_1 = require("./common");
class ShowClipboardInFile {
    constructor(_manager) {
        this._manager = _manager;
        this._disposable = [];
        this._disposable.push(vscode.commands.registerCommand(common_1.commandList.showClipboardInFile, this.execute, this));
    }
    execute(item) {
        return __awaiter(this, void 0, void 0, function* () {
            const clip = item.clip;
            if (!clip.createdLocation) {
                return;
            }
            const uri = clip.createdLocation.uri;
            const document = yield vscode.workspace.openTextDocument(uri);
            const opts = {
                viewColumn: vscode.ViewColumn.Active,
            };
            if (document.getText(clip.createdLocation.range) === clip.value) {
                opts.selection = clip.createdLocation.range;
            }
            else {
                // Find current position of value
                const indexes = [];
                const text = document.getText();
                let lastIndex = text.indexOf(clip.value);
                while (lastIndex >= 0) {
                    indexes.push(lastIndex);
                    lastIndex = text.indexOf(clip.value, lastIndex + 1);
                }
                if (indexes.length >= 0) {
                    const offset = document.offsetAt(clip.createdLocation.range.start);
                    // Sort by distance of initial location
                    indexes.sort((a, b) => Math.abs(a - offset) - Math.abs(b - offset));
                    const index = indexes[0];
                    if (index >= 0) {
                        const range = new vscode.Range(document.positionAt(index), document.positionAt(index + clip.value.length));
                        opts.selection = range;
                    }
                }
            }
            yield vscode.window.showTextDocument(document, opts);
        });
    }
    dispose() {
        this._disposable.forEach(d => d.dispose());
    }
}
exports.ShowClipboardInFile = ShowClipboardInFile;
//# sourceMappingURL=showClipboardInFile.js.map
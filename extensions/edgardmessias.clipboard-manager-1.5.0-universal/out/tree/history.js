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
exports.ClipboardTreeDataProvider = exports.ClipHistoryItem = void 0;
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
const common_1 = require("../commads/common");
const util_1 = require("../util");
class ClipHistoryItem extends vscode.TreeItem {
    constructor(clip) {
        super(clip.value);
        this.clip = clip;
        this.contextValue = "clipHistoryItem:";
        this.label = this.clip.value.replace(/\s+/g, " ").trim();
        this.tooltip = this.clip.value;
        this.command = {
            command: common_1.commandList.historyTreeDoubleClick,
            title: "Paste",
            tooltip: "Paste",
            arguments: [this.clip],
        };
        if (this.clip.createdLocation) {
            this.resourceUri = this.clip.createdLocation.uri;
            this.contextValue += "file";
            this.tooltip = `File: ${this.resourceUri.fsPath}\nValue: ${this.tooltip}\n`;
        }
        else {
            const basePath = path.join(__filename, "..", "..", "..", "resources");
            this.iconPath = {
                light: path.join(basePath, "light", "string.svg"),
                dark: path.join(basePath, "dark", "string.svg"),
            };
        }
    }
}
exports.ClipHistoryItem = ClipHistoryItem;
class ClipboardTreeDataProvider {
    constructor(_manager) {
        this._manager = _manager;
        this._disposables = [];
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this._manager.onDidChangeClipList(() => {
            this._onDidChangeTreeData.fire(null);
        });
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(_element) {
        const clips = this._manager.clips;
        const maxLength = `${clips.length}`.length;
        const childs = clips.map((c, index) => {
            const item = new ClipHistoryItem(c);
            const indexNumber = (0, util_1.leftPad)(index + 1, maxLength, "0");
            item.label = `${indexNumber}) ${item.label}`;
            return item;
        });
        return childs;
    }
    dispose() {
        this._disposables.forEach(d => d.dispose());
    }
}
exports.ClipboardTreeDataProvider = ClipboardTreeDataProvider;
//# sourceMappingURL=history.js.map
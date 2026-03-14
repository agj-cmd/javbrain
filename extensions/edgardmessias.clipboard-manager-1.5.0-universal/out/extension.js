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
exports.deactivate = exports.activate = void 0;
const vscode = __importStar(require("vscode"));
const clipboard_1 = require("./clipboard");
const apiGetMonitor_1 = require("./commads/apiGetMonitor");
const clearClipboardHistory_1 = require("./commads/clearClipboardHistory");
const historyTreeDoubleClick_1 = require("./commads/historyTreeDoubleClick");
const pickAndPaste_1 = require("./commads/pickAndPaste");
const removeClipboardHistory_1 = require("./commads/removeClipboardHistory");
const setClipboardValue_1 = require("./commads/setClipboardValue");
const showClipboardInFile_1 = require("./commads/showClipboardInFile");
const completion_1 = require("./completion");
const manager_1 = require("./manager");
const monitor_1 = require("./monitor");
const history_1 = require("./tree/history");
const copyToHistory_1 = require("./commads/copyToHistory");
let manager;
// this method is called when your extension is activated
function activate(context) {
    return __awaiter(this, void 0, void 0, function* () {
        const disposable = [];
        // Check the clipboard is working
        try {
            yield clipboard_1.defaultClipboard.readText(); // Read test
        }
        catch (error) {
            console.log(error);
            // Small delay to force show error
            setTimeout(() => {
                if (error.message) {
                    vscode.window.showErrorMessage(error.message);
                }
                else {
                    vscode.window.showErrorMessage("Failed to read value from clipboard, check the console log");
                }
            }, 2000);
            // Disable clipboard listening
            clipboard_1.defaultClipboard.dispose();
            return;
        }
        // Add to disposable list the default clipboard
        disposable.push(clipboard_1.defaultClipboard);
        const monitor = new monitor_1.Monitor(clipboard_1.defaultClipboard);
        disposable.push(monitor);
        manager = new manager_1.ClipboardManager(context, monitor);
        disposable.push(manager);
        // API Commands
        disposable.push(new apiGetMonitor_1.ApiGetMonitor(monitor));
        // Commands
        disposable.push(new pickAndPaste_1.PickAndPasteCommand(manager));
        disposable.push(new historyTreeDoubleClick_1.HistoryTreeDoubleClickCommand(manager));
        disposable.push(new setClipboardValue_1.SetClipboardValueCommand(manager));
        disposable.push(new removeClipboardHistory_1.RemoveClipboardHistory(manager));
        disposable.push(new showClipboardInFile_1.ShowClipboardInFile(manager));
        disposable.push(new clearClipboardHistory_1.ClearClipboardHistory(manager));
        disposable.push(new copyToHistory_1.CopyToHistoryCommand(monitor));
        const completion = new completion_1.ClipboardCompletion(manager);
        // disposable.push(completion);
        // All files types
        disposable.push(vscode.languages.registerCompletionItemProvider({
            scheme: "file",
        }, completion));
        // All files types (New file)
        disposable.push(vscode.languages.registerCompletionItemProvider({
            scheme: "untitled",
        }, completion));
        const clipboardTreeDataProvider = new history_1.ClipboardTreeDataProvider(manager);
        disposable.push(clipboardTreeDataProvider);
        disposable.push(vscode.window.registerTreeDataProvider("clipboardHistory", clipboardTreeDataProvider));
        const updateConfig = () => {
            const config = vscode.workspace.getConfiguration("clipboard-manager");
            monitor.checkInterval = config.get("checkInterval", 500);
            monitor.onlyWindowFocused = config.get("onlyWindowFocused", true);
            monitor.maxClipboardSize = config.get("maxClipboardSize", 1000000);
        };
        updateConfig();
        disposable.push(vscode.workspace.onDidChangeConfiguration(e => e.affectsConfiguration("clipboard-manager") && updateConfig()));
        context.subscriptions.push(...disposable);
        return {
            completion,
            manager,
        };
    });
}
exports.activate = activate;
// this method is called when your extension is deactivated
function deactivate() {
    if (manager) {
        manager.saveClips();
    }
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map
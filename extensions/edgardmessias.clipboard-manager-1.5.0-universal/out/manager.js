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
exports.ClipboardManager = void 0;
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
class ClipboardManager {
    get clips() {
        return this._clips;
    }
    constructor(context, _monitor) {
        this.context = context;
        this._monitor = _monitor;
        this._disposable = [];
        this._clips = [];
        this.lastUpdate = 0;
        // get clipboard() {
        //   return this._clipboard;
        // }
        this._onDidClipListChange = new vscode.EventEmitter();
        this.onDidChangeClipList = this._onDidClipListChange.event;
        this._monitor.onDidChangeText(this.updateClipList, this, this._disposable);
        this.loadClips();
        vscode.window.onDidChangeWindowState(state => {
            if (state.focused) {
                this.checkClipsUpdate();
            }
        }, this, this._disposable);
        vscode.workspace.onDidChangeConfiguration(e => e.affectsConfiguration("clipboard-manager") && this.saveClips());
    }
    updateClipList(change) {
        this.checkClipsUpdate();
        const config = vscode.workspace.getConfiguration("clipboard-manager");
        const maxClips = config.get("maxClips", 100);
        const avoidDuplicates = config.get("avoidDuplicates", true);
        let item = {
            value: change.value,
            createdAt: change.timestamp,
            copyCount: 1,
            useCount: 0,
            language: change.language,
            createdLocation: change.location,
        };
        if (avoidDuplicates) {
            const index = this._clips.findIndex(c => c.value === change.value);
            // Remove same clips and move recent to top
            if (index >= 0) {
                this._clips[index].copyCount++;
                item = this._clips[index];
                this._clips = this._clips.filter(c => c.value !== change.value);
            }
        }
        // Add to top
        this._clips.unshift(item);
        // Max clips to store
        if (maxClips > 0) {
            this._clips = this._clips.slice(0, maxClips);
        }
        this._onDidClipListChange.fire();
        this.saveClips();
    }
    setClipboardValue(value) {
        return __awaiter(this, void 0, void 0, function* () {
            this.checkClipsUpdate();
            const config = vscode.workspace.getConfiguration("clipboard-manager");
            const moveToTop = config.get("moveToTop", true);
            const index = this._clips.findIndex(c => c.value === value);
            if (index >= 0) {
                this._clips[index].useCount++;
                if (moveToTop) {
                    const clips = this.clips.splice(index, 1);
                    this._clips.unshift(...clips);
                    this._onDidClipListChange.fire();
                    this.saveClips();
                }
            }
            return yield this._monitor.clipboard.writeText(value);
        });
    }
    removeClipboardValue(value) {
        this.checkClipsUpdate();
        const prevLength = this._clips.length;
        this._clips = this._clips.filter(c => c.value !== value);
        this._onDidClipListChange.fire();
        this.saveClips();
        return prevLength !== this._clips.length;
    }
    clearAll() {
        this.checkClipsUpdate();
        this._clips = [];
        this._onDidClipListChange.fire();
        this.saveClips();
        return true;
    }
    /**
     * `clipboard.history.json`
     */
    getStoreFile() {
        let folder = os.tmpdir();
        if (this.context.storagePath) {
            const parts = this.context.storagePath.split(/[\\/]workspaceStorage[\\/]/);
            folder = parts[0];
        }
        const filePath = path.join(folder, "clipboard.history.json");
        const config = vscode.workspace.getConfiguration("clipboard-manager");
        const saveTo = config.get("saveTo");
        if (typeof saveTo === "string") {
            return saveTo;
        }
        if (saveTo === false) {
            return false;
        }
        return filePath;
    }
    jsonReplacer(key, value) {
        if (key === "createdLocation" && value) {
            value = {
                range: {
                    start: value.range.start,
                    end: value.range.end,
                },
                uri: value.uri.toString(),
            };
        }
        else if (value instanceof vscode.Uri) {
            value = value.toString();
        }
        return value;
    }
    saveClips() {
        const file = this.getStoreFile();
        if (!file) {
            return;
        }
        let json = "[]";
        try {
            json = JSON.stringify({
                version: 2,
                clips: this._clips,
            }, this.jsonReplacer, 2);
        }
        catch (error) {
            console.error(error);
            return;
        }
        try {
            fs.writeFileSync(file, json);
            this.lastUpdate = fs.statSync(file).mtimeMs;
        }
        catch (error) {
            switch (error.code) {
                case "EPERM":
                    vscode.window.showErrorMessage(`Not permitted to save clipboards on "${file}"`);
                    break;
                case "EISDIR":
                    vscode.window.showErrorMessage(`Failed to save clipboards on "${file}", because the path is a directory`);
                    break;
                default:
                    console.error(error);
            }
        }
    }
    /**
     * Check the clip history changed from another workspace
     */
    checkClipsUpdate() {
        const file = this.getStoreFile();
        if (!file) {
            return;
        }
        if (!fs.existsSync(file)) {
            return;
        }
        const stat = fs.statSync(file);
        if (this.lastUpdate < stat.mtimeMs) {
            this.lastUpdate = stat.mtimeMs;
            this.loadClips();
        }
    }
    loadClips() {
        let json;
        const file = this.getStoreFile();
        if (file && fs.existsSync(file)) {
            try {
                json = fs.readFileSync(file);
                this.lastUpdate = fs.statSync(file).mtimeMs;
            }
            catch (error) {
                // ignore
            }
        }
        else {
            // Read from old storage
            json = this.context.globalState.get("clips");
        }
        if (!json) {
            return;
        }
        let stored = {};
        try {
            stored = JSON.parse(json);
        }
        catch (error) {
            console.log(error);
            return;
        }
        if (!stored.version || !stored.clips) {
            return;
        }
        let clips = stored.clips;
        if (stored.version === 1) {
            clips = clips.map(c => {
                c.createdAt = c.timestamp;
                c.copyCount = 1;
                c.useCount = 0;
                c.createdLocation = c.location;
                return c;
            });
            stored.version = 2;
        }
        this._clips = clips.map(c => {
            const clip = {
                value: c.value,
                createdAt: c.createdAt,
                copyCount: c.copyCount,
                useCount: c.copyCount,
                language: c.language,
            };
            if (c.createdLocation) {
                const uri = vscode.Uri.parse(c.createdLocation.uri);
                const range = new vscode.Range(c.createdLocation.range.start.line, c.createdLocation.range.start.character, c.createdLocation.range.end.line, c.createdLocation.range.end.character);
                clip.createdLocation = new vscode.Location(uri, range);
            }
            return clip;
        });
        this._onDidClipListChange.fire();
    }
    dispose() {
        this._disposable.forEach(d => d.dispose());
    }
}
exports.ClipboardManager = ClipboardManager;
//# sourceMappingURL=manager.js.map
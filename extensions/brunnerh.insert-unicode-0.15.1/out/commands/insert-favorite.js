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
exports.insertFavoriteCommandFactory = void 0;
const vscode_1 = require("vscode");
const config_1 = require("../config");
const data_1 = require("../data");
const editor_1 = require("../utility/editor");
const favorites_1 = require("../utility/favorites");
const quick_pick_1 = require("../utility/quick-pick");
const insertFavoriteCommandFactory = (codeConverter) => (editor) => __awaiter(void 0, void 0, void 0, function* () {
    const showNode = (node) => __awaiter(void 0, void 0, void 0, function* () {
        const picks = [];
        if (node.directories) {
            for (let key in node.directories) {
                const directory = node.directories[key];
                directory.parent = node;
                picks.push({
                    label: `$(file-directory) ${key}`,
                    onSelected: () => __awaiter(void 0, void 0, void 0, function* () {
                        const success = yield showNode(directory);
                        if (success === false)
                            yield showNode(node);
                    })
                });
            }
        }
        if (node.items) {
            for (const codes of node.items) {
                // JSON does not support hex numbers (0x...), so it has to be parsed from a string.
                const normalized = codes.map(c => typeof c === 'number' ? c : parseInt(c));
                let entry = data_1.data.find(entry => entry.codes.length === normalized.length &&
                    entry.codes.every((c, i) => c === normalized[i]));
                // Get individual Unicode character names and create synthetic entry.
                if (entry === undefined) {
                    const names = normalized
                        .map(code => data_1.data.find(entry => entry.codes.length === 1 && entry.codes[0] === code))
                        .map(entry => entry === undefined ? '?' : entry.name);
                    entry = {
                        codes: normalized,
                        name: `[${names.join(', ')}]`,
                        aliases: [],
                        category: null,
                    };
                }
                const item = Object.assign(Object.assign({}, (0, quick_pick_1.unicodeEntryToQuickPick)(entry)), { onSelected: () => (0, editor_1.insert)(editor, entry, codeConverter(normalized)) });
                picks.push(item);
            }
        }
        if (picks.length === 0) {
            vscode_1.window.showWarningMessage("Directory is empty.");
            return false;
        }
        if (node.parent !== undefined)
            picks.unshift({
                label: '$(arrow-left) ..',
                onSelected: () => __awaiter(void 0, void 0, void 0, function* () {
                    yield showNode(node.parent);
                }),
            });
        const selection = yield vscode_1.window.showQuickPick(picks, { matchOnDescription: true });
        if (selection === undefined)
            return true;
        yield selection.onSelected();
        return true;
    });
    const favorites = config_1.Config.section.inspect('favorites');
    const sets = [
        {
            label: 'User Settings',
            favorites: favorites.globalValue,
        },
        {
            label: 'Workspace Settings',
            favorites: favorites.workspaceValue,
        }
    ].filter(s => s.favorites !== undefined && (0, favorites_1.empty)(s.favorites) === false);
    if (sets.length === 0) {
        yield showNode(favorites.defaultValue);
    }
    else if (sets.length === 1) {
        yield showNode(sets[0].favorites);
    }
    else {
        const behavior = config_1.Config.section.get('favoritesScopeBehavior');
        switch (behavior) {
            case 'merge':
                yield showNode((0, favorites_1.merge)(sets.map(s => s.favorites)));
                break;
            case 'separate':
                yield showNode({
                    directories: Object.fromEntries(sets.map(s => [s.label, s.favorites])),
                });
                break;
            default:
                vscode_1.window.showErrorMessage(`Unknown "favoritesScopeBehavior" setting: ${behavior}`);
        }
    }
});
exports.insertFavoriteCommandFactory = insertFavoriteCommandFactory;
//# sourceMappingURL=insert-favorite.js.map
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
exports.insertCommandFactory = void 0;
const vscode_1 = require("vscode");
const config_1 = require("../config");
const data_1 = require("../data");
const editor_1 = require("../utility/editor");
const quick_pick_1 = require("../utility/quick-pick");
const code_operations_1 = require("../utility/code-operations");
const recently_used_list_1 = require("../utility/recently-used-list");
const allQuickPicks = data_1.data.map(quick_pick_1.unicodeEntryToQuickPick);
const quickPicksByFilter = new Map([
    [null, allQuickPicks],
]);
function getQuickPicks(preFilter) {
    if (quickPicksByFilter.has(preFilter) === false)
        quickPicksByFilter.set(preFilter, allQuickPicks.filter(item => preFilter(item.entry)));
    return quickPicksByFilter.get(preFilter);
}
/**
 * Gets the quick picks for the characters according to user settings.
 * @param preFilter Filter that is always applied to the list of characters.
 * @returns The quick picks for the characters.
 */
function getUserQuickPicks(preFilter) {
    let picks = getQuickPicks(preFilter).slice();
    if (config_1.Config.section.get('include-sequences') === false)
        picks = picks.filter(item => item.entry.codes.length === 1);
    if (config_1.Config.section.get('include-skin-tone-variants') === false)
        picks = picks.filter(item => item.entry.codes.length === 1
            || item.entry.codes.some(code_operations_1.isSkinToneModifier) === false);
    if (config_1.Config.section.get('enableAliases') === false)
        picks = picks.map(p => {
            const copy = Object.assign({}, p);
            delete copy.detail;
            return copy;
        });
    const recentlyUsed = recently_used_list_1.RecentlyUsed.get();
    const recentlyUsedSet = new Set(recentlyUsed);
    const sortValue = (item) => recentlyUsedSet.has(item.entry.name) ?
        recentlyUsed.indexOf(item.entry.name) :
        Number.MAX_SAFE_INTEGER;
    picks.sort((a, b) => sortValue(a) - sortValue(b));
    return picks;
}
;
/**
 * Creates a command function with the specified settings.
 * @param codeConverter Conversion from selected Unicode code to text to insert into the editor.
 * @param preFilter Filter that is always applied to the list of characters.
 * @param matchExact Whether to search the Unicode characters for the exact search term.
 */
const insertCommandFactory = (codeConverter, preFilter, matchExact) => (editor, _edit, ...args) => __awaiter(void 0, void 0, void 0, function* () {
    const search = args[0];
    const disableFiltering = config_1.Config.section.get("disable-pre-filtering");
    /**
     * Prompts the user for an initial search term.
     * @param search Pre-filled search term.
     * @param prompt The prompt text above the search input.
     */
    const filter = (search, prompt) => __awaiter(void 0, void 0, void 0, function* () {
        const filter = yield vscode_1.window.showInputBox({
            placeHolder: 'e.g. "ok hand"',
            prompt: prompt === undefined ? "Enter a search term." : prompt,
            value: search
        });
        if (filter === undefined)
            return;
        yield select(filter);
    });
    /**
     * Shows a filtered selection list from which to choose a character.
     * @param search The search term to which to limit the list of characters to choose from.
     */
    const select = (search) => __awaiter(void 0, void 0, void 0, function* () {
        let pickItems = getUserQuickPicks(preFilter);
        if (search !== undefined) {
            const searchNormalized = search.toUpperCase();
            pickItems = pickItems.filter(quickPick => matchExact
                ? quickPick.entry.name.toUpperCase() === searchNormalized
                : quickPick.entry.name.toUpperCase().indexOf(searchNormalized) !== -1);
            // Instant insert on exact match
            if (pickItems.length === 1) {
                const entry = pickItems[0].entry;
                (0, editor_1.insert)(editor, entry, codeConverter(entry.codes));
                return;
            }
            if (pickItems.length === 0) {
                yield filter(search, `No items found for "${search}".`);
                return;
            }
        }
        const quickPickOptions = {
            matchOnDescription: true,
            matchOnDetail: true,
            placeHolder: disableFiltering ? '' :
                `Results for "${search}" (${pickItems.length}). (Press ESC to search for another term.)`,
            pageSize: config_1.Config.section.get("page-size")
        };
        const selection = yield (disableFiltering
            ? vscode_1.window.showQuickPick(pickItems, quickPickOptions)
            : (0, quick_pick_1.showPaginatedQuickPick)(pickItems, quickPickOptions));
        if (selection !== undefined)
            yield (0, editor_1.insert)(editor, selection.entry, codeConverter(selection.entry.codes));
        else if (disableFiltering === false)
            // Go back to search.
            yield filter(search);
    });
    if (typeof search === 'string')
        yield select(search);
    else if (disableFiltering)
        yield select();
    else
        yield filter();
});
exports.insertCommandFactory = insertCommandFactory;
//# sourceMappingURL=insert-character.js.map
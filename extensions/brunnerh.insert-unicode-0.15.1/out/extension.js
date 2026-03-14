'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
const data_table_1 = require("./commands/data-table");
const hex_to_text_1 = require("./commands/hex-to-text");
const identify_characters_1 = require("./commands/identify-characters");
const insert_character_1 = require("./commands/insert-character");
const insert_favorite_1 = require("./commands/insert-favorite");
const insert_font_1 = require("./commands/insert-font");
const manage_favorites_1 = require("./commands/manage-favorites");
const recently_used_1 = require("./commands/recently-used");
const context_1 = require("./context");
const migrations_1 = require("./migrations");
const state_1 = require("./state");
const code_conversion_1 = require("./utility/code-conversion");
const code_operations_1 = require("./utility/code-operations");
const identify_view_1 = require("./views/identify-view");
function activate(context) {
    console.log('Unicode Tools activated.');
    context_1.Context.set(context);
    const previousVersion = context.globalState.get(state_1.Keys.lastVersion);
    const currentVersion = context.extension.packageJSON.version;
    context.globalState.update(state_1.Keys.lastVersion, currentVersion);
    (0, migrations_1.migrate)(previousVersion, currentVersion);
    const register = vscode.commands.registerTextEditorCommand;
    const emojiFilter = (item) => (0, code_operations_1.isEmoji)(item.codes);
    const tokens = [
        register('insert-unicode.insertText', (0, insert_character_1.insertCommandFactory)(code_conversion_1.codesToText, null, false)),
        register('insert-unicode.insertTextExact', (0, insert_character_1.insertCommandFactory)(code_conversion_1.codesToText, null, true)),
        register('insert-unicode.insertCode', (0, insert_character_1.insertCommandFactory)(code_conversion_1.codesToHex, null, false)),
        register('insert-unicode.insertCodeExact', (0, insert_character_1.insertCommandFactory)(code_conversion_1.codesToHex, null, true)),
        register('insert-unicode.insertDecimalCode', (0, insert_character_1.insertCommandFactory)(code_conversion_1.codesToDecimal, null, false)),
        register('insert-unicode.insertDecimalCodeExact', (0, insert_character_1.insertCommandFactory)(code_conversion_1.codesToDecimal, null, true)),
        register('insert-unicode.insertEmojiText', (0, insert_character_1.insertCommandFactory)(code_conversion_1.codesToText, emojiFilter, false)),
        register('insert-unicode.insertEmojiDecimalCode', (0, insert_character_1.insertCommandFactory)(code_conversion_1.codesToDecimal, emojiFilter, false)),
        register('insert-unicode.insertEmojiHexCode', (0, insert_character_1.insertCommandFactory)(code_conversion_1.codesToHex, emojiFilter, false)),
        register('insert-unicode.insertFavoriteText', (0, insert_favorite_1.insertFavoriteCommandFactory)(code_conversion_1.codesToText)),
        register('insert-unicode.insertFavoriteDecimalCode', (0, insert_favorite_1.insertFavoriteCommandFactory)(code_conversion_1.codesToDecimal)),
        register('insert-unicode.insertFavoriteHexCode', (0, insert_favorite_1.insertFavoriteCommandFactory)(code_conversion_1.codesToHex)),
        vscode.commands.registerCommand('insert-unicode.manageFavorites', manage_favorites_1.manageFavorites),
        register('insert-unicode.insertFont', insert_font_1.insertFont),
        register('insert-unicode.fromHexCode', hex_to_text_1.hexToText),
        register('insert-unicode.identify', identify_characters_1.identifyCharacters),
        vscode.commands.registerCommand('insert-unicode.dataTable', data_table_1.dataTable),
        vscode.commands.registerCommand('insert-unicode.clearRecentlyUsed', recently_used_1.clearRecentlyUsed),
        new identify_view_1.IdentifyViewProvider(context.extensionUri).register(),
    ];
    context.subscriptions.push(...tokens);
}
exports.activate = activate;
function deactivate() {
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map
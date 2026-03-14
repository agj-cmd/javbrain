"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Config = void 0;
const vscode = require("vscode");
const code_operations_1 = require("./utility/code-operations");
class Config {
    static get section() {
        return vscode.workspace.getConfiguration(this.sectionName);
    }
    /**
     * Filters Unicode entries according to the current configuration.
     * @param entries The entries to filter.
     * @returns Filtered list of entries.
     */
    static filterData(entries) {
        let filtered = entries;
        if (Config.section.get('include-sequences') === false)
            filtered = filtered.filter(entry => entry.codes.length === 1);
        if (Config.section.get('include-skin-tone-variants') === false)
            filtered = filtered.filter(entry => entry.codes.length === 1
                || entry.codes.some(code_operations_1.isSkinToneModifier) === false);
        return filtered;
    }
}
exports.Config = Config;
Config.sectionName = 'insert-unicode';
//# sourceMappingURL=config.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecentlyUsed = void 0;
const config_1 = require("../config");
const context_1 = require("../context");
const state_1 = require("../state");
const stateKey = state_1.Keys.recentlyUsed;
class RecentlyUsed {
    /**
     * Clears the recently used list.
     */
    static clear() {
        context_1.Context.current.globalState.update(stateKey, []);
    }
    /**
     * Gets list of recently used characters by name.
     * Empty if recently used list is disabled.
     * The list is sorted from most recent to least recent.
     * @returns List of recently used characters
     */
    static get() {
        if (config_1.Config.section.get('enableRecentlyUsed') === false)
            return [];
        return context_1.Context.current.globalState.get(stateKey, []);
    }
    /**
     * Adds a character to the recently used list.
     * Does nothing if the list is disabled.
     * @param name The name of the character to add to the list.
     */
    static addEntry(name) {
        if (config_1.Config.section.get('enableRecentlyUsed') === false)
            return;
        const list = context_1.Context.current.globalState.get(stateKey, []);
        const newList = [name, ...list.filter(n => n !== name)]
            .slice(0, config_1.Config.section.get('recentlyUsedLimit'));
        context_1.Context.current.globalState.update(stateKey, newList);
    }
}
exports.RecentlyUsed = RecentlyUsed;
//# sourceMappingURL=recently-used-list.js.map
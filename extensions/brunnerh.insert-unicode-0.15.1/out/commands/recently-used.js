"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearRecentlyUsed = void 0;
const recently_used_list_1 = require("../utility/recently-used-list");
const vscode_1 = require("vscode");
const clearRecentlyUsed = () => {
    recently_used_list_1.RecentlyUsed.clear();
    vscode_1.window.showInformationMessage('Recently used list cleared.');
};
exports.clearRecentlyUsed = clearRecentlyUsed;
//# sourceMappingURL=recently-used.js.map
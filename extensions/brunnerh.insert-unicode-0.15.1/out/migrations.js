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
exports.migrate = void 0;
const messages_1 = require("./utility/messages");
/**
 * Executes automatic migrations or shows migration instructions to the user.
 * @param previousVersion The previously used version of the extension.
 * @param currentVersion The currently used version of the extension.
 */
function migrate(previousVersion, currentVersion) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // const previous = parseVersion(previousVersion);
            // const current = parseVersion(currentVersion);
            // ...
        }
        catch (error) {
            (0, messages_1.showIssueError)('Failed to migrate extension version.', {
                errorInfo: {
                    previousVersion,
                    currentVersion,
                    error: (0, messages_1.makeErrorSerializable)(error),
                },
                title: 'Migration Error',
            }, { title: 'Close' });
        }
    });
}
exports.migrate = migrate;
function parseVersion(versionString) {
    if (versionString === undefined)
        return undefined;
    const parts = versionString.split('.');
    return {
        major: +parts[0],
        minor: +parts[1],
        patch: +parts[2],
    };
}
//# sourceMappingURL=migrations.js.map
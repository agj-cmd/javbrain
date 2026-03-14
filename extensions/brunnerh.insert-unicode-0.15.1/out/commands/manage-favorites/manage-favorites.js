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
exports.manageFavorites = void 0;
const vscode_1 = require("vscode");
const config_1 = require("../../config");
const path = require("path");
const favorites_1 = require("../../utility/favorites");
const context_1 = require("../../context");
const manageFavorites = () => {
    const title = 'Manage Unicode Favorites';
    const view = vscode_1.window.createWebviewPanel('insert-unicode-favorite-manager', title, vscode_1.ViewColumn.Active, {
        enableScripts: true,
        localResourceRoots: [vscode_1.Uri.file(context_1.Context.current.extensionPath)],
    });
    const viewScriptRoot = view.webview.asWebviewUri(vscode_1.Uri.file(path.join(context_1.Context.current.extensionPath, 'out', 'commands', 'manage-favorites')));
    view.webview.html = html(viewScriptRoot.toString() + '/');
    const postMessage = (message) => view.webview.postMessage(message);
    view.webview.onDidReceiveMessage((message) => __awaiter(void 0, void 0, void 0, function* () {
        const respond = (response) => postMessage(Object.assign(Object.assign({}, response), { sequenceNumber: message.sequenceNumber }));
        switch (message.type) {
            case 'get-favorites':
                const favorites = config_1.Config.section.inspect('favorites');
                const sections = [
                    {
                        type: 'global',
                        favorites: favorites.globalValue,
                        show: true,
                    },
                    {
                        type: 'workspace',
                        favorites: favorites.workspaceValue,
                        show: vscode_1.workspace.name !== undefined,
                    },
                ].filter(s => s.show);
                respond({
                    type: 'favorites',
                    sections,
                });
                view.title = title;
                break;
            case 'get-unicode-data':
                const dataModule = yield Promise.resolve().then(() => require('../../data'));
                respond({ type: 'unicode-data', data: config_1.Config.filterData(dataModule.data) });
                break;
            case 'get-config-value':
                const value = config_1.Config.section.get(message.config);
                respond({
                    type: 'config-value',
                    key: message.config,
                    value,
                });
                break;
            case 'changed':
                view.title = title + '*';
                break;
            case 'save':
                try {
                    const favorites = config_1.Config.section.inspect('favorites');
                    const updates = {
                        global: {
                            current: favorites.globalValue,
                            target: true,
                        },
                        workspace: {
                            current: favorites.workspaceValue,
                            target: false,
                        },
                    };
                    for (const section of message.sections) {
                        const update = updates[section.type];
                        if (update.current === undefined && (0, favorites_1.empty)(section.favorites, false))
                            continue;
                        yield config_1.Config.section.update('favorites', section.favorites, update.target);
                    }
                    view.title = title;
                }
                catch (e) {
                    vscode_1.window.showErrorMessage('Saving of favorites failed. See developer console for error.');
                    console.error('Favorites save error:', e);
                }
                break;
            default:
                break;
        }
    }));
};
exports.manageFavorites = manageFavorites;
const html = (scriptRoot) => /*html*/ `
	<!DOCTYPE html>
	<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<meta http-equiv="Content-Security-Policy"
				content="default-src 'self' vscode-resource: https:;
					script-src vscode-resource: 'self' 'unsafe-inline' 'unsafe-eval' https:;
					style-src vscode-resource: 'self' 'unsafe-inline';
					img-src 'self' vscode-resource: data:"/>
			<base href="${scriptRoot}">
			<title>Manage Unicode Favorites</title>
		</head>
		<body>
			<script src="./view.js"></script>
		</body>
	</html>
`;
//# sourceMappingURL=manage-favorites.js.map
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
exports.dataTable = void 0;
const vscode_1 = require("vscode");
const config_1 = require("../../config");
const path = require("path");
const context_1 = require("../../context");
const dataTable = () => __awaiter(void 0, void 0, void 0, function* () {
    const title = 'Unicode Data Table';
    const view = vscode_1.window.createWebviewPanel('insert-unicode-data-table', title, vscode_1.ViewColumn.Active, {
        enableScripts: true,
        localResourceRoots: [vscode_1.Uri.file(context_1.Context.current.extensionPath)],
    });
    const viewScriptRoot = view.webview.asWebviewUri(vscode_1.Uri.file(path.join(context_1.Context.current.extensionPath, 'out', 'commands', 'data-table')));
    view.webview.html = html(viewScriptRoot.toString() + '/');
    const postMessage = (message) => view.webview.postMessage(message);
    const dataModule = yield Promise.resolve().then(() => require('../../data'));
    view.webview.onDidReceiveMessage((message) => __awaiter(void 0, void 0, void 0, function* () {
        const respond = (response) => postMessage(Object.assign(Object.assign({}, response), { sequenceNumber: message.sequenceNumber }));
        switch (message.type) {
            case 'get-unicode-data':
                respond({ type: 'unicode-data', data: config_1.Config.filterData(dataModule.data) });
                break;
            default:
                break;
        }
    }));
    const updateHandlers = [
        vscode_1.workspace.onDidChangeConfiguration((e) => __awaiter(void 0, void 0, void 0, function* () {
            if (e.affectsConfiguration(config_1.Config.sectionName))
                postMessage({
                    type: 'unicode-data',
                    data: config_1.Config.filterData(dataModule.data),
                    sequenceNumber: -1,
                });
        })),
    ];
    view.onDidDispose(() => updateHandlers.forEach(h => h.dispose()));
});
exports.dataTable = dataTable;
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
			<title>Unicode Data Table</title>
		</head>
		<body>
			<script src="./view.js"></script>
		</body>
	</html>
`;
//# sourceMappingURL=data-table.js.map
const vscode = require('vscode');
const { capListKey, getCustomList } = require('./config');
const { editDialog } = require('./commands/editDialog');
const { convertToCurlyQuotation, convertToStraightQuotation } = require('./commands/convertQuotes');
const { textCleanup } = require('./commands/textCleanup');
const { insertSpace } = require('./commands/insertSpace');
const { nextEmptyLineDown, nextEmptyLineUp } = require('./commands/nextEmptyLine');
const { goToLineNext, goToLinePrevious } = require('./commands/goToLine');
const { joinLineAbove } = require('./commands/joinLineAbove');
const { toggleCase } = require('./commands/toggleCase');

function activate(context) {
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration(capListKey)) {
      }
    }),
    vscode.commands.registerCommand('JavEditorHelper.toggleCase', toggleCase),
    vscode.commands.registerCommand('JavEditorHelper.editDialog', editDialog),
    vscode.commands.registerCommand('Jav.convertToCurlyQuotation', convertToCurlyQuotation),
    vscode.commands.registerCommand('Jav.convertToStraightQuotation', convertToStraightQuotation),
    vscode.commands.registerCommand('Jav.textCleanup', textCleanup),
    vscode.commands.registerCommand('JavEditorHelper.insertSpace', insertSpace),
    vscode.commands.registerCommand('JavEditorHelper.nextEmptyLineDown', nextEmptyLineDown),
    vscode.commands.registerCommand('JavEditorHelper.nextEmptyLineUp', nextEmptyLineUp),
    vscode.commands.registerCommand('JavEditorHelper.goToLineNext', goToLineNext),
    vscode.commands.registerCommand('JavEditorHelper.goToLinePrevious', goToLinePrevious),
    vscode.commands.registerCommand('JavEditorHelper.joinLineAbove', joinLineAbove),
  );
}

function deactivate() {}
module.exports = { activate, deactivate };
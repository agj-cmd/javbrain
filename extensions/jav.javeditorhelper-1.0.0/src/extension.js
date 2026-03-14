const vscode = require('vscode');
const { capListKey, glossaryCacheInvalidate, watchersSetup } = require('./config');
const { editDialog } = require('./commands/editDialog');
const { convertToCurlyQuotation, convertToStraightQuotation } = require('./commands/convertQuotes');
const { textCleanup } = require('./commands/textCleanup');
const { insertSpace } = require('./commands/insertSpace');
const { joinLineAbove, joinLineBelow } = require('./commands/joinLines');
const { toggleCase } = require('./commands/toggleCase');
const { smartDelete } = require('./commands/SmartDelete');
const { smartSelect } = require('./commands/smartSelect');
const { selectSurround, removeSurround } = require('./commands/surroundingPairs');


function activate(context) {

  // set up file watchers for glossary source files
  watchersSetup(context);

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration(capListKey)) {
        glossaryCacheInvalidate();
        watchersSetup(context);
      }
    }),

    // Editing
    vscode.commands.registerCommand('JavEditorHelper.toggleCase', toggleCase),
    vscode.commands.registerCommand('JavEditorHelper.editDialog', editDialog),
    vscode.commands.registerCommand('JavEditorHelper.insertSpace', insertSpace),
    vscode.commands.registerCommand('JavEditorHelper.joinLineAbove', joinLineAbove),
    vscode.commands.registerCommand('JavEditorHelper.joinLineBelow', joinLineBelow),
    vscode.commands.registerCommand('JavEditorHelper.smartDelete', smartDelete),
    vscode.commands.registerCommand('JavEditorHelper.smartSelect', smartSelect),
    vscode.commands.registerCommand('JavEditorHelper.selectSurround', selectSurround),
    vscode.commands.registerCommand('JavEditorHelper.removeSurround', removeSurround),


    // Quotes & cleanup
    vscode.commands.registerCommand('JavEditorHelper.convertToCurlyQuotation', convertToCurlyQuotation),
    vscode.commands.registerCommand('JavEditorHelper.convertToStraightQuotation', convertToStraightQuotation),
    vscode.commands.registerCommand('JavEditorHelper.textCleanup', textCleanup),
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
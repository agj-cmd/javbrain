const vscode = require('vscode');
const { loadList } = require('./utils/fileLoader');

// updated key name here
const capListKey = 'JavEditorHelper.capitalizationFilePaths';

function getCustomList() {
  // read an array of paths (defaults to empty array)
  const paths = vscode.workspace.getConfiguration().get(capListKey, []);
  if (!Array.isArray(paths)) {
    // for backward-compat (if someone still put a string)
    return loadList(paths);
  }
  // load each file and flatten all entries into one array
  return paths.flatMap(p => loadList(p));
}
const punctKey = 'JavEditorHelper.punctuationCharacters';

function getPunctuationCharacters() {
  const def = `,\.!\?'";:“”‘’`;
  const raw = vscode.workspace.getConfiguration().get(punctKey, def);
  const escaped = raw.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  return new RegExp(`[${escaped}]`, 'gu');
}

module.exports = {
  capListKey,
  getCustomList,
  punctKey,
  getPunctuationCharacters
};

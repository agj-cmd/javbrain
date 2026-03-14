const vscode = require("vscode");
const https = require("https");
const fs = require("fs").promises;
const path = require("path");

let definitionsCache = {};
let cacheFilePath = "";


async function loadDefinitionsCache(context) {
  cacheFilePath = path.join(context.globalStorageUri.fsPath, "definitions-cache.json");
  
  try {
    await fs.mkdir(context.globalStorageUri.fsPath, { recursive: true });
    const data = await fs.readFile(cacheFilePath, "utf8");
    definitionsCache = JSON.parse(data);
    console.log("Definitions cache loaded successfully");
  } catch (err) {
    definitionsCache = {};
    console.log("Starting with empty definitions cache");
  }
}

async function saveDefinitionsCache() {
  try {
    await fs.writeFile(cacheFilePath, JSON.stringify(definitionsCache, null, 2), "utf8");
  } catch (err) {
    console.error("Failed to save definitions cache:", err);
  }
}

function registerOpenCacheCommand(context) {
  const disposable = vscode.commands.registerCommand("javWordHelper.openCache", async () => {
    try {
      await fs.mkdir(context.globalStorageUri.fsPath, { recursive: true });
      
      try {
        await fs.access(cacheFilePath);
      } catch {
        await fs.writeFile(cacheFilePath, JSON.stringify(definitionsCache, null, 2), "utf8");
      }

      const doc = await vscode.workspace.openTextDocument(cacheFilePath);
      await vscode.window.showTextDocument(doc);
      vscode.window.showInformationMessage("Definitions cache opened");
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to open cache file: ${err.message}`);
    }
  });

  context.subscriptions.push(disposable);
}

function fetchData(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on("error", reject);
  });
}

function registerCommand(context, command, label, queryParam) {
  const disposable = vscode.commands.registerCommand(command, async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return vscode.window.showErrorMessage("No active editor");

    const selection = editor.selection;
    let word = editor.document.getText(selection).trim();
    let range = selection;

    if (!word) {
      range = editor.document.getWordRangeAtPosition(selection.active);
      if (!range) {
        vscode.window.showWarningMessage("No word found at cursor.");
        return;
      }
      word = editor.document.getText(range);
    }

    try {
      const data = await fetchData(`https://api.datamuse.com/words?${queryParam}=${encodeURIComponent(word)}`);
      if (!data.length) return vscode.window.showInformationMessage("No results found.");

      const pick = vscode.window.createQuickPick();
      pick.items = data.map(d => ({ label: d.word }));
      pick.onDidChangeSelection(([item]) => {
        if (item) {
          editor.edit(edit => edit.replace(range, item.label));
          pick.dispose();
        }
      });
      pick.onDidHide(() => pick.dispose());
      pick.show();
    } catch (err) {
      vscode.window.showErrorMessage("Error fetching results.");
    }
  });

  context.subscriptions.push(disposable);
}

function registerDefinitionHover(context) {
  const hoverProvider = vscode.languages.registerHoverProvider(
    { scheme: 'file', pattern: '**' },
    {
      async provideHover(document, position, token) {
        const wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange) return;

        const word = document.getText(wordRange);
        const wordLower = word.toLowerCase();

        try {
          let definitions = [];

          if (definitionsCache[wordLower]) {
            definitions = definitionsCache[wordLower];
          } else {
            const result = await fetchData(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(wordLower)}`);
            
            if (result && result.length > 0 && result[0].meanings) {
              definitions = [];
              result[0].meanings.forEach(meaning => {
                const pos = meaning.partOfSpeech || '';
                meaning.definitions.forEach(def => {
                  definitions.push(`${pos}\t${def.definition}`);
                });
              });
              
              definitionsCache[wordLower] = definitions;
              await saveDefinitionsCache();
            }
          }

  if (!definitions.length) {
  vscode.window.showInformationMessage(`No definition found for "${word}"`);
  return;
}

          const markdown = new vscode.MarkdownString();
          markdown.appendMarkdown(`**${word}**\n\n`);
          
          definitions.forEach(def => {
            const parts = def.split('\t');
            const pos = parts[0] || '';
            const definition = parts[1] || def;
            markdown.appendMarkdown(`• *(${pos})* ${definition}\n\n`);
          });

          return new vscode.Hover(markdown);
        } catch (err) {
          return;
        }
      }
    }
  );

  context.subscriptions.push(hoverProvider);
}

function registerMenuCommand(context) {
  const disposable = vscode.commands.registerCommand("javWordHelper.menu", async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return vscode.window.showErrorMessage("No active editor");

    const selection = editor.selection;
    let word = editor.document.getText(selection).trim();

    if (!word) {
      const range = editor.document.getWordRangeAtPosition(selection.active);
      if (range) {
        word = editor.document.getText(range);
      }
    }

    if (!word) {
      return vscode.window.showWarningMessage("No word or selection found.");
    }

    const items = [
      { label: "Find Synonyms", command: "javWordHelper.findSynonyms" },
      { label: "Soundalikes", command: "javWordHelper.soundalikes" },
      { label: "Rhymes", command: "javWordHelper.rhymes" },
    ];

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: word
    });

    if (selected) {
      await vscode.commands.executeCommand(selected.command);
    }
  });

  context.subscriptions.push(disposable);
}

async function activate(context) {

  // Load the definitions cache on activation
  await loadDefinitionsCache(context);

  registerMenuCommand(context);
  registerCommand(context, "javWordHelper.findSynonyms", "Find Synonyms", "ml");
  registerCommand(context, "javWordHelper.soundalikes", "Soundalikes", "sl");
  registerCommand(context, "javWordHelper.rhymes", "Rhymes", "rel_rhy");
  registerDefinitionHover(context);
  registerOpenCacheCommand(context);
}

function deactivate() {}

module.exports = { activate, deactivate };
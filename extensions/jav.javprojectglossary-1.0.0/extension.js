// extension.js -- working version with always preview
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { collectGlossaryFiles } = require('./glossaryUtils');
const { createDashboardCommand } = require('./filesDashboard');
const { GlossarySearchViewProvider } = require('./glossarySearch');
const { createScanFolderTermsCommand } = require('./scanFolderTerms');

const LAST_PROJECT_SEARCH_FILES = 'javProjectGlossary.lastProjectSearchFiles';
const USAGE_DATA_KEY = 'javProjectGlossary.usageData';

function trackUsage(context, term) {
  const usageData = context.globalState.get(USAGE_DATA_KEY, {});
  const existing = usageData[term.toLowerCase()] || { count: 0, lastUsed: 0 };
  usageData[term.toLowerCase()] = {
    count: existing.count + 1,
    lastUsed: Date.now()
  };
  context.globalState.update(USAGE_DATA_KEY, usageData);
}

function createCompletionProvider(context, inputPaths) {
  const config = vscode.workspace.getConfiguration('javProjectGlossary');
  const scopeList = config.get('includedScopes') || ['markdown', 'plaintext', 'jav'];

  const documentFilters = scopeList.map(lang => ({ language: lang }));

  return vscode.languages.registerCompletionItemProvider(
    documentFilters,
    {
      provideCompletionItems(document, position) {
        const currentConfig = vscode.workspace.getConfiguration('javProjectGlossary');
        const range = document.getWordRangeAtPosition(position);
        const typedRaw = range ? document.getText(range) : '';
        const typed = typedRaw.toLowerCase();

        const normalizedInputPaths = inputPaths.map(p => path.normalize(p));
        const glossaryFiles = collectGlossaryFiles(normalizedInputPaths);
        const usageData = context.globalState.get(USAGE_DATA_KEY, {});
        const items = [];

        for (const inputPath of glossaryFiles) {
          const normalizedPath = path.normalize(inputPath);

          if (!fs.existsSync(normalizedPath)) continue;

          try {
            const lines = fs.readFileSync(normalizedPath, 'utf8')
              .split(/\r?\n/)
              .filter(Boolean);

            for (const line of lines) {
              const [bodyRaw, description] = line.split(/:(.+)/);
              const body = bodyRaw.trim();
              const prefix = body.replace(/^\*(.*?)\*$/, '$1').toLowerCase();
              const usage = usageData[prefix] || { count: 0, lastUsed: 0 };

              const item = new vscode.CompletionItem(prefix, vscode.CompletionItemKind.Snippet);
              item.insertText = body + (currentConfig.get('snippetSpaceAfter', true) ? ' ' : '');
              item.filterText = prefix.replace(/\s+/g, '');
              item.range = range;
              item.detail = `Used ${usage.count}x`;
              item.documentation = (description || body).trim();
              item.commitCharacters = [',', '.', '?', '!', ';'];

              item.command = {
                command: 'javProjectGlossary.trackUsage',
                arguments: [prefix, body]
              };

              items.push(item);
            }
          } catch (err) {
            console.error('[createCompletionProvider] Error reading file:', normalizedPath, err.message);
          }
        }

        // Filter to only matching items
        const typedNoSpaces = typed.replace(/\s+/g, '');
        const filtered = items.filter(item => {
          const labelCompact = item.label.toLowerCase().replace(/\s+/g, '');
          return labelCompact.startsWith(typedNoSpaces) || item.label.toLowerCase().startsWith(typed);
        });

      // Sort: top 3 most recent first, then by frequency
        const used = filtered.filter(item => {
          const u = usageData[item.label.toLowerCase()];
          return u && u.count > 0;
        });
        const unused = filtered.filter(item => {
          const u = usageData[item.label.toLowerCase()];
          return !u || u.count === 0;
        });

        // Sort all used by recency to find top 3
        used.sort((a, b) => {
          const au = usageData[a.label.toLowerCase()] || { lastUsed: 0 };
          const bu = usageData[b.label.toLowerCase()] || { lastUsed: 0 };
          return bu.lastUsed - au.lastUsed;
        });

        const recentSlice = used.splice(0, 3);

        // Remaining used items sorted by frequency
        used.sort((a, b) => {
          const au = usageData[a.label.toLowerCase()] || { count: 0 };
          const bu = usageData[b.label.toLowerCase()] || { count: 0 };
          return bu.count - au.count;
        });

        // Unused sorted alphabetically
        unused.sort((a, b) => a.label.localeCompare(b.label));

        // Reassemble
        filtered.length = 0;
        filtered.push(...recentSlice, ...used, ...unused);

        // Assign sortText to override VS Code's default sorting
        filtered.forEach((item, index) => {
          item.sortText = String(index).padStart(5, '0');
        });

        // Preselect first (most recent)
        if (filtered.length > 0) {
          filtered[0].preselect = true;
        }

        return filtered;
      }
    },
    ''
  );
}

function activate(context) {
  const config = vscode.workspace.getConfiguration('javProjectGlossary');
  const inputPaths = config.get('inputFiles');

  if (!Array.isArray(inputPaths) || inputPaths.length === 0) {
    vscode.window.showWarningMessage('JavProjectGlossary: No input file paths configured.');
    return;
  }

  console.log('[activate] Input paths from config:', inputPaths);

  // Register usage tracking command
  context.subscriptions.push(
    vscode.commands.registerCommand('javProjectGlossary.trackUsage', (term, correctBody) => {
      trackUsage(context, term);

      // Correct casing if needed
      if (correctBody) {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;
        const pos = editor.selection.active;
        // Inserted text was prefix-length (typedRaw + prefix remainder)
        const insertedLength = term.length;
        const startPos = pos.translate(0, -insertedLength);
        const replaceRange = new vscode.Range(startPos, pos);
        const currentText = editor.document.getText(replaceRange);
        if (currentText !== correctBody && currentText.toLowerCase() === term.toLowerCase()) {
          editor.edit(editBuilder => {
            editBuilder.replace(replaceRange, correctBody);
          });
        }
      }
    })
  );

  // Register completion provider
  const completionProvider = createCompletionProvider(context, inputPaths);
  context.subscriptions.push(completionProvider);

  // Watch glossary files for changes (for hover/definition providers)
  const normalizedInputPaths = inputPaths.map(p => path.normalize(p));
  const glossaryFiles = collectGlossaryFiles(normalizedInputPaths);

  console.log('[activate] Glossary files to watch:', glossaryFiles);

  for (const inputPath of glossaryFiles) {
    const normalizedPath = path.normalize(inputPath);
    if (fs.existsSync(normalizedPath)) {
      fs.watchFile(normalizedPath, { interval: 1000 }, () => {});
    }
  }

  context.subscriptions.push({
    dispose: () => glossaryFiles.forEach(p => {
      const normalizedPath = path.normalize(p);
      fs.unwatchFile(normalizedPath);
    })
  });

  const hoverProvider = vscode.languages.registerHoverProvider(
    [{ language: 'markdown' }, { language: 'plaintext' }, { language: 'jav' }],
    {
      provideHover(document, position) {
        const range = document.getWordRangeAtPosition(position);
        if (!range) return;
        const word = document.getText(range).toLowerCase();

        const normalizedInputPaths = inputPaths.map(p => path.normalize(p));

        for (const inputPath of collectGlossaryFiles(normalizedInputPaths)) {
          const normalizedPath = path.normalize(inputPath);

          if (!fs.existsSync(normalizedPath)) continue;

          try {
            const lines = fs.readFileSync(normalizedPath, 'utf8')
              .split(/\r?\n/)
              .filter(Boolean);

            for (const line of lines) {
              const [bodyRaw, description] = line.split(/:(.+)/);
              const prefix = bodyRaw.trim().replace(/^\*(.*?)\*$/, '$1').toLowerCase();
              if (prefix === word || prefix + 's' === word || prefix === word + 's') {
                const desc = (description || bodyRaw).trim();
                return new vscode.Hover(`**${bodyRaw.trim()}** — ${desc}`);
              }
            }
          } catch (err) {
            console.error('[hoverProvider] Error reading file:', normalizedPath, err.message);
          }
        }
        return null;
      }
    }
  );

  const definitionProvider = vscode.languages.registerDefinitionProvider(
    [{ language: 'markdown' }, { language: 'plaintext' }, { language: 'jav' }],
    {
      provideDefinition(document, position) {
        const editor = vscode.window.activeTextEditor;
        const sel = editor?.selection;
        let word;
        if (sel && !sel.isEmpty) {
          word = document.getText(sel).trim().toLowerCase();
        } else {
          const range = document.getWordRangeAtPosition(position);
          if (!range) return;
          word = document.getText(range).toLowerCase();
        }

        const normalizedInputPaths = inputPaths.map(p => path.normalize(p));

        for (const inputPath of collectGlossaryFiles(normalizedInputPaths)) {
          const normalizedPath = path.normalize(inputPath);

          if (!fs.existsSync(normalizedPath)) continue;

          try {
            const rawLines = fs.readFileSync(normalizedPath, 'utf8').split(/\r?\n/);

            for (let i = 0; i < rawLines.length; i++) {
              const [bodyRaw] = rawLines[i].split(/:(.+)/);
              const prefix = bodyRaw.trim().replace(/^\*(.*?)\*$/, '$1').toLowerCase();
              if (prefix === word || prefix + 's' === word || prefix === word + 's') {
                const pos = new vscode.Position(i, 0);
                return new vscode.Location(uri, pos);
              }
            }
          } catch (err) {
            console.error('[definitionProvider] Error reading file:', normalizedPath, err.message);
          }
        }
        return null;
      }
    }
  );

  context.subscriptions.push(hoverProvider, definitionProvider);

const addCmd = vscode.commands.registerCommand('javProjectGlossary.addToDictionary', async () => {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;
  const document = editor.document;
  const selection = editor.selection;

  let word;
  if (!selection.isEmpty) {
    word = document.getText(selection);
  } else {
    const range = document.getWordRangeAtPosition(selection.active);
    if (!range) {
      vscode.window.showErrorMessage('No word found at cursor.');
      return;
    }
    word = document.getText(range);
  }

  // Check if the word already exists in the glossary with a definition
  const normalizedInputPaths = inputPaths.map(p => path.normalize(p));
  const glossaryFiles = collectGlossaryFiles(normalizedInputPaths);
  console.log('[addToDictionary] inputPaths:', inputPaths);
  console.log('[addToDictionary] glossaryFiles resolved:', glossaryFiles);
  const wordLower = word.trim().toLowerCase();
  let foundWithDefinition = false;

  for (const filePath of glossaryFiles) {
    const normalizedPath = path.normalize(filePath);
    if (!fs.existsSync(normalizedPath)) continue;
    try {
      const lines = fs.readFileSync(normalizedPath, 'utf8').split(/\r?\n/).filter(Boolean);
      for (const line of lines) {
        const [bodyRaw, description] = line.split(/:(.+)/);
        const prefix = bodyRaw.trim().replace(/^\*(.*?)\*$/, '$1').toLowerCase();
        if (prefix === wordLower || prefix + 's' === wordLower || prefix === wordLower + 's') {
          foundWithDefinition = true;
          break;
        }
      }
    } catch (err) {
      console.error('[addToDictionary] Error reading file:', normalizedPath, err.message);
    }
    if (foundWithDefinition) break;
  }

  // If term exists with a definition, show hover instead
  if (foundWithDefinition) {
    await vscode.commands.executeCommand('editor.action.showHover');
    return;
  }

  // Otherwise, run the add-to-glossary flow
  const items = glossaryFiles.map(p => ({
    label: path.basename(p),
    description: path.dirname(p),
    fullPath: p
  }));

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select glossary file to add to'
  });
  if (!selected) return;

  setTimeout(async () => {
    const entry = await vscode.window.showInputBox({
      prompt: 'Edit the glossary entry',
      value: `${word}`
    });
    if (!entry?.trim()) return;

    try {
      const normalizedPath = path.normalize(selected.fullPath);
      fs.appendFileSync(normalizedPath, `\n${entry.trim()}`);
      vscode.window.showInformationMessage(`Added "${word}" to glossary.`);
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to add to glossary: ${err.message}`);
    }
  }, 100);
});
  context.subscriptions.push(addCmd);

  // Glossary search sidebar view
  const glossarySearchProvider = new GlossarySearchViewProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      GlossarySearchViewProvider.viewType,
      glossarySearchProvider
    )
  );

  // Glossary search command — reveals sidebar
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'javProjectGlossary.glossarySearch',
      () => glossarySearchProvider.reveal()
    )
  );

  // Focus glossary search input (F2)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'javProjectGlossary.searchFocusInput',
      () => glossarySearchProvider.focusSearchInput()
    )
  );

  const projectSearch = vscode.commands.registerCommand('javProjectGlossary.projectSearch', async () => {
    const normalizedInputPaths = inputPaths.map(p => path.normalize(p));
    const glossaryFiles = collectGlossaryFiles(normalizedInputPaths);

    if (!glossaryFiles.length) {
      vscode.window.showErrorMessage('No glossary files found (make sure .txt or .md files exist in the folders).');
      return;
    }

    const last = context.globalState.get(LAST_PROJECT_SEARCH_FILES, []).map(p => path.normalize(p));
    const glossaryItems = glossaryFiles.map(p => ({
      label: path.basename(p),
      description: path.dirname(p),
      fullPath: p
    }));
    const preselect = glossaryItems.filter(i => last.includes(i.fullPath));

    const selected = await new Promise(resolve => {
      const qp = vscode.window.createQuickPick();
      qp.canSelectMany = true;
      qp.items = glossaryItems;
      qp.selectedItems = preselect;
      qp.placeholder = 'Select glossary files to search with';
      qp.onDidAccept(() => { resolve(qp.selectedItems); qp.hide(); });
      qp.onDidHide(() => resolve([]));
      qp.show();
    });

    if (!selected?.length) return;
    const glossPaths = selected.map(i => i.fullPath);
    await context.globalState.update(LAST_PROJECT_SEARCH_FILES, glossPaths);

    const wf = vscode.workspace.workspaceFolders;
    if (!wf?.length) {
      vscode.window.showErrorMessage('No workspace folder open.');
      return;
    }

    const root = path.normalize(wf[0].uri.fsPath);
    const fileUris = await vscode.workspace.findFiles('**/*', '**/node_modules/**');
    const relFiles = fileUris.map(u => path.relative(root, path.normalize(u.fsPath)));

    const allDirs = new Set();
    relFiles.forEach(f => {
      const dir = path.dirname(f);
      const parts = dir.split(path.sep);
      for (let i = 0; i < parts.length; i++) {
        const sub = parts.slice(0, i + 1).join(path.sep);
        allDirs.add(sub);
      }
    });
    allDirs.add('');

    const folders = Array.from(allDirs)
      .sort()
      .map(d => d === '' ? '.' : d + path.sep);

    const picks = [
      ...folders.map(f => ({ label: f, type: 'folder' })),
      ...relFiles.map(f => ({ label: f, type: 'file' }))
    ];

    const fileSelection = await vscode.window.showQuickPick(picks, {
      canPickMany: true,
      placeHolder: 'Select folders/files to search'
    });
    if (!fileSelection?.length) return;

    const include = fileSelection
      .map(s => s.type === 'folder' ? (s.label === '.' ? '**/*' : `${s.label}**/*`) : s.label)
      .join(', ');

    const terms = [];
    for (const gp of glossPaths) {
      const normalizedPath = path.normalize(gp);

      if (!fs.existsSync(normalizedPath)) continue;

      const stat = fs.statSync(normalizedPath);
      if (!stat.isFile()) continue;

      try {
        for (const line of fs.readFileSync(normalizedPath, 'utf8').split(/\r?\n/).filter(Boolean)) {
          const term = line.split(/:(.+)/)[0].trim();
          if (term) terms.push(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        }
      } catch (err) {
        console.error('[projectSearch] Error reading file:', normalizedPath, err.message);
      }
    }

    if (!terms.length) {
      vscode.window.showInformationMessage('No glossary terms found.');
      return;
    }

    const query = `\\b(${terms.join('|')})\\b`;

    await vscode.commands.executeCommand('workbench.view.search');
    await vscode.commands.executeCommand('workbench.action.findInFiles', {
      query,
      triggerSearch: true,
      isRegex: true,
      isCaseSensitive: false,
      filesToInclude: include
    });
  });
  context.subscriptions.push(projectSearch);

  // Usage stats command
  const usageStatsCmd = vscode.commands.registerCommand('javProjectGlossary.showUsageStats', () => {
    const usageData = context.globalState.get(USAGE_DATA_KEY, {});
    const sorted = Object.entries(usageData)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 30);

    if (!sorted.length) {
      vscode.window.showInformationMessage('No usage data yet.');
      return;
    }

    const items = sorted.map(([term, data]) => ({
      label: term,
      description: `${data.count} uses`,
      detail: `Last used: ${new Date(data.lastUsed).toLocaleString()}`
    }));

    vscode.window.showQuickPick(items, { placeHolder: 'Top used glossary terms' });
  });
  context.subscriptions.push(usageStatsCmd);

  // Reset usage stats command
  const resetUsageCmd = vscode.commands.registerCommand('javProjectGlossary.resetUsageStats', async () => {
    const confirm = await vscode.window.showWarningMessage(
      'Reset all glossary usage statistics?',
      { modal: true },
      'Reset'
    );
    if (confirm === 'Reset') {
      await context.globalState.update(USAGE_DATA_KEY, {});
      vscode.window.showInformationMessage('Usage statistics reset.');
    }
  });
  context.subscriptions.push(resetUsageCmd);

  const dashboardCmd = vscode.commands.registerCommand(
    'javProjectGlossary.openDashboard',
    createDashboardCommand(context)
  );
  context.subscriptions.push(dashboardCmd);

  const focusDashboardSearchCmd = vscode.commands.registerCommand(
    'javProjectGlossary.focusDashboardSearch',
    () => {
      // This command will be handled by the webview when it's active
      // The keybinding is set to only work when the webview is focused
    }
  );
  context.subscriptions.push(focusDashboardSearchCmd);

  // Scan folder for glossary terms (context menu)
  const scanFolderCmd = vscode.commands.registerCommand(
    'javProjectGlossary.scanFolderTerms',
    createScanFolderTermsCommand(context)
  );
  context.subscriptions.push(scanFolderCmd);
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
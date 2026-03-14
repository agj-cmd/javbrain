const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const os = require('os');

function activate(context) {
  const disposable = vscode.commands.registerCommand('toggleSettingsGroup.pickGroup', async () => {
    // determine global user settings.json (portable and standard)
    let settingsFile;
    const execPath = process.execPath;
    const portableEnv = process.env.VSCODE_PORTABLE;
    const portableDataDir = path.join(path.dirname(execPath), 'data');
    const candidates = [];
    if (portableEnv) candidates.push(portableEnv);
    candidates.push(portableDataDir);
    // check portable
    for (const dir of candidates) {
      const f = path.join(dir, 'user-data', 'User', 'settings.json');
      if (fs.existsSync(f)) { settingsFile = f; break; }
    }
    // fallback to standard
    if (!settingsFile) {
      const home = os.homedir();
      if (process.platform === 'win32') settingsFile = path.join(home, 'AppData', 'Roaming', 'Code', 'User', 'settings.json');
      else if (process.platform === 'darwin') settingsFile = path.join(home, 'Library', 'Application Support', 'Code', 'User', 'settings.json');
      else settingsFile = path.join(home, '.config', 'Code', 'User', 'settings.json');
    }

    // read settings
    let text;
    try { text = fs.readFileSync(settingsFile, 'utf8'); }
    catch (err) { vscode.window.showErrorMessage(`Could not read settings file: ${err.message}`); return; }

    const lines = text.split(/\r?\n/);
    const groups = [];
    let currentGroup;

    // parse groups and options: each //TG marks a group, each //\d marks an option
    for (let i = 0; i < lines.length; i++) {
      const tg = lines[i].match(/\/\/\s*TG\s+(.*)/);
      if (tg) {
        currentGroup = { name: tg[1].trim(), options: [] };
        groups.push(currentGroup);
      } else if (currentGroup) {
        const opt = lines[i].match(/\/\/\s*(\d+)\s*(.*)/);
        if (opt) {
          const idxLine = i;
          // collect all lines until next //'number' or //TG or EOF
          const settingLines = [];
          for (let j = i + 1; j < lines.length; j++) {
            if (lines[j].match(/\/\/\s*\d+/) || lines[j].match(/\/\/\s*TG\s+/)) {
              break;
            }
            settingLines.push(j);
          }
          const label = opt[2].trim() || `Option ${opt[1]}`;
          currentGroup.options.push({ indexCommentLine: idxLine, settingLines, label });
        }
      }
    }

    if (!groups.length) {
      vscode.window.showInformationMessage('No toggle groups found in settings');
      return;
    }

    // pick group
    const groupName = await vscode.window.showQuickPick(groups.map(g => g.name), { placeHolder: 'Select a settings group' });
    if (!groupName) return;
    const group = groups.find(g => g.name === groupName);

    // pick option
    const optLabel = await vscode.window.showQuickPick(group.options.map(o => o.label), { placeHolder: `Select a value for ${groupName}` });
    if (!optLabel) return;
    const chosen = group.options.find(o => o.label === optLabel);

    // toggle: uncomment chosen, comment others
    for (const opt of group.options) {
      const isChosen = opt === chosen;
      // toggle index comment
      const rawIdx = lines[opt.indexCommentLine].replace(/^\/\/+/, '').trim();
      lines[opt.indexCommentLine] = isChosen ? `//${rawIdx}` : `// ${rawIdx}`;
      // toggle each setting line
      for (const ln of opt.settingLines) {
        const raw = lines[ln].replace(/^\s*\/\/+/, '').trim();
        lines[ln] = isChosen ? raw : `// ${raw}`;
      }
    }

    // write back
    try {
      fs.writeFileSync(settingsFile, lines.join('\n'), 'utf8');
      vscode.window.showInformationMessage('Settings toggled');
    } catch (err) {
      vscode.window.showErrorMessage(`Error writing settings: ${err.message}`);
    }
  });

  context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = { activate, deactivate };

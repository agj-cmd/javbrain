const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const os = require('os');

function activate(context) {
	const disposable = vscode.commands.registerCommand('toggleSettingsGroup.pickGroup', async () => {
		const settingsFile = findSettingsFile();
		if (!settingsFile) {
			vscode.window.showErrorMessage('Could not locate settings.json');
			return;
		}

		let text;
		try { text = fs.readFileSync(settingsFile, 'utf8'); }
		catch (err) { vscode.window.showErrorMessage(`Could not read settings file: ${err.message}`); return; }

		const lines = text.split(/\r?\n/);
		const groups = parseGroups(lines);

		if (!groups.length) {
			vscode.window.showInformationMessage('No toggle groups found. Add //TG markers to settings.json.');
			return;
		}

		// build flat list with separators
		const items = [];
		for (const group of groups) {
			items.push({ label: group.name, kind: vscode.QuickPickItemKind.Separator });
			for (const option of group.options) {
				const active = isOptionActive(option, lines);
				items.push({
					label: `${active ? '$(check) ' : '      '}${option.label}`,
					_option: option,
					_group: group,
				});
			}
		}

		const picked = await vscode.window.showQuickPick(items, { placeHolder: 'Toggle Settings' });
		if (!picked || !picked._option) return;

		// toggle: uncomment chosen, comment others
		for (const option of picked._group.options) {
			const isChosen = option === picked._option;
			for (const ln of option.settingLines) {
				if (isChosen) {
					// uncomment: strip leading // but preserve indentation
					lines[ln] = lines[ln].replace(/^(\s*)\/\/\s?/, '$1');
				} else {
					// comment: add // after existing indentation, skip if already commented
					if (!lines[ln].match(/^\s*\/\//)) {
						lines[ln] = lines[ln].replace(/^(\s*)/, '$1// ');
					}
				}
			}
		}

		try {
			fs.writeFileSync(settingsFile, lines.join('\n'), 'utf8');
			vscode.window.showInformationMessage(`${picked._group.name} → ${picked._option.label}`);
		} catch (err) {
			vscode.window.showErrorMessage(`Error writing settings: ${err.message}`);
		}
	});

	context.subscriptions.push(disposable);
}

/**
 * Locate the global user settings.json (portable-aware).
 */
function findSettingsFile() {
	const execPath = process.execPath;
	const portableEnv = process.env.VSCODE_PORTABLE;
	const portableDataDir = path.join(path.dirname(execPath), 'data');

	const candidates = [];
	if (portableEnv) candidates.push(portableEnv);
	candidates.push(portableDataDir);

	for (const dir of candidates) {
		const f = path.join(dir, 'user-data', 'User', 'settings.json');
		if (fs.existsSync(f)) return f;
	}

	const home = os.homedir();
	if (process.platform === 'win32') return path.join(home, 'AppData', 'Roaming', 'Code', 'User', 'settings.json');
	if (process.platform === 'darwin') return path.join(home, 'Library', 'Application Support', 'Code', 'User', 'settings.json');
	return path.join(home, '.config', 'Code', 'User', 'settings.json');
}

/**
 * Parse //TG and //N markers from settings.json lines.
 *
 * Format:
 *   //TG Group Name
 *   //1 Option Label
 *   "editor.fontSize": 12,
 *   "editor.lineHeight": 18,
 *   //2 Another Option
 *   // "editor.fontSize": 18,
 *   // "editor.lineHeight": 28,
 */
function parseGroups(lines) {
	const groups = [];
	let currentGroup = null;

	for (let i = 0; i < lines.length; i++) {
		const tg = lines[i].match(/\/\/\s*TG\s+(.*)/);
		if (tg) {
			currentGroup = { name: tg[1].trim(), options: [] };
			groups.push(currentGroup);
			continue;
		}

		if (!currentGroup) continue;

		// blank line ends the group
		if (lines[i].trim() === '') {
			currentGroup = null;
			continue;
		}

		const opt = lines[i].match(/\/\/\s*(\d+)\s*(.*)/);
		if (opt) {
			const settingLines = [];
			for (let j = i + 1; j < lines.length; j++) {
				if (lines[j].match(/\/\/\s*\d+\s/) || lines[j].match(/\/\/\s*TG\s+/)) break;
				// skip blank lines
				if (lines[j].trim() === '') break;
				settingLines.push(j);
			}
			currentGroup.options.push({
				label: opt[2].trim() || `Option ${opt[1]}`,
				settingLines,
			});
		}
	}

	return groups;
}

/**
 * An option is "active" if none of its setting lines are commented out.
 */
function isOptionActive(option, lines) {
	if (!option.settingLines.length) return false;
	return option.settingLines.every(ln => !lines[ln].match(/^\s*\/\//));
}

function deactivate() {}

module.exports = { activate, deactivate };
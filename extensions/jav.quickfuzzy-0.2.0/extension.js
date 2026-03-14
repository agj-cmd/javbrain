const vscode = require("vscode");
const FUZZY_MATCH_THRESHOLD = .8;
let matchDecorationType = null;
let activeQp = null;
let qpAccepted = false;

// ── Decorations ────────────────────────────────────────────────────────

function updateFastFuzzyDecorations(editor, searchValue, filtered) {
	if (!matchDecorationType) return;
	if (!searchValue || searchValue.trim() === "") {
		editor.setDecorations(matchDecorationType, []);
		return;
	}
	const searchWords = searchValue.toLowerCase().trim().split(/\s+/).filter(w => w.length > 0);
	if (searchWords.length === 0) {
		editor.setDecorations(matchDecorationType, []);
		return;
	}

	const decorations = [];
	for (const item of filtered) {
		const lineText = editor.document.lineAt(item.lineNumber).text;
		for (const sw of searchWords) {
			const escaped = sw.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
			const regex = new RegExp("\\b" + escaped + "\\b", "gi");
			let match;
			while ((match = regex.exec(lineText)) !== null) {
				const startPos = new vscode.Position(item.lineNumber, match.index);
				const endPos = new vscode.Position(item.lineNumber, match.index + match[0].length);
				decorations.push({ range: new vscode.Range(startPos, endPos) });
			}
		}
	}
	editor.setDecorations(matchDecorationType, decorations);
}

// ── Fast Quick Fuzzy ───────────────────────────────────────────────────

function showFastQuickFuzzy() {
	const editor = vscode.window.activeTextEditor;
	if (!editor) return;

	const originalSelection = editor.selection;
	const doc = editor.document;
	const rawLines = doc.getText().split(/\r?\n/);
	const currentLine = editor.selection.active.line;

	// Build line data (non-empty lines only)
	const lineData = [];
	for (let i = 0; i < rawLines.length; i++) {
		const trimmed = rawLines[i].trim();
		if (trimmed) {
			lineData.push({
				text: trimmed,
				lineNumber: i,
				words: trimmed.toLowerCase().split(/\s+/).filter(w => w.length > 0)
			});
		}
	}

	const fuzzyMatch = (searchWord, targetWord) => {
		const s = searchWord.toLowerCase();
		const t = targetWord.toLowerCase();
		if (s.length === 0 || t.length === 0) return false;
		if (t.includes(s)) return true;
		let searchIndex = 0, matchCount = 0, lastMatchPos = -1, maxGap = 0;
		for (let i = 0; i < t.length && searchIndex < s.length; i++) {
			if (t[i] === s[searchIndex]) {
				if (lastMatchPos >= 0) maxGap = Math.max(maxGap, i - lastMatchPos - 1);
				lastMatchPos = i;
				searchIndex++;
				matchCount++;
			}
		}
		const requiredMatches = Math.ceil(s.length * FUZZY_MATCH_THRESHOLD);
		if (matchCount < requiredMatches) return false;
		if (matchCount < s.length * .75) return false;
		const maxAllowedGap = s.length <= 4 ? 2 : 3;
		if (maxGap > maxAllowedGap) return false;
		if (t.length / s.length > 3) return false;
		return true;
	};

	const filterLines = (value) => {
		if (!value || value.trim() === "") {
			return lineData.map(item => ({ ...item, matchedWords: [] }));
		}
		const searchWords = value.toLowerCase().trim().split(/\s+/).filter(w => w.length > 0);
		if (searchWords.length === 0) {
			return lineData.map(item => ({ ...item, matchedWords: [] }));
		}
		const results = [];
		for (const item of lineData) {
			const matchedWords = new Set();
			let allMatch = true;
			for (const sw of searchWords) {
				let found = false;
				for (const dw of item.words) {
					if (fuzzyMatch(sw, dw)) { matchedWords.add(dw); found = true; }
				}
				if (!found) { allMatch = false; break; }
			}
			if (allMatch) results.push({ ...item, matchedWords: Array.from(matchedWords) });
		}
		return results;
	};

	// Find position: literal typed string first, then first exact word match
	const findFirstMatchPosition = (text, matchedWords, searchWords) => {
		if (searchWords.length === 0 && matchedWords.length === 0) return -1;
		const lower = text.toLowerCase();

		// Try literal typed string (all words joined)
		const literal = searchWords.join(" ");
		if (literal) {
			const idx = lower.indexOf(literal);
			if (idx >= 0) return idx;
		}

		// Fallback: first typed word found in the line (preserves typed order)
		const words = searchWords.length > 0 ? searchWords : matchedWords;
		for (const w of words) {
			const escaped = w.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
			const m = new RegExp("\\b" + escaped + "\\b", "gi").exec(text);
			if (m) return m.index;
		}

		return -1;
	};

	const toQuickPickItems = (filtered, searchValue) => {
		const maxLen = 120;
		const searchWords = (searchValue || "").toLowerCase().trim().split(/\s+/).filter(w => w.length > 0);

		return filtered.map(item => {
			let label = item.text;

			// Center label around first match if line is too long
			if (label.length > maxLen && ((item.matchedWords && item.matchedWords.length > 0) || searchWords.length > 0)) {
				const pos = findFirstMatchPosition(label, item.matchedWords || [], searchWords);
				if (pos >= 0) {
					const half = Math.floor(maxLen / 2);
					let start = Math.max(0, pos - half);
					let end = Math.min(label.length, start + maxLen);
					start = Math.max(0, end - maxLen);
					const prefix = start > 0 ? "\u2026" : "";
					const suffix = end < label.length ? "\u2026" : "";
					label = prefix + label.substring(start, end) + suffix;
				}
			}

			return {
				label: label,
				alwaysShow: true,
				_lineNumber: item.lineNumber
			};
		});
	};

	const findNearest = (items) => {
		let nearestIdx = 0, minDist = Infinity;
		for (let i = 0; i < items.length; i++) {
			const dist = Math.abs(items[i]._lineNumber - currentLine);
			if (dist < minDist) { minDist = dist; nearestIdx = i; }
		}
		return nearestIdx;
	};

	const qp = vscode.window.createQuickPick();
	qp.placeholder = "Fast Quick Fuzzy \u2014 type to filter lines";
	qp.matchOnLabel = false;
	qp.matchOnDescription = false;
	qp.matchOnDetail = false;
	qp.sortByLabel = false;
	qp.items = toQuickPickItems(filterLines(""), "");

	// Pre-select nearest line to cursor
	if (qp.items.length > 0) {
		qp.activeItems = [qp.items[findNearest(qp.items)]];
	}

	let internalUpdate = false;

	activeQp = qp;
	qpAccepted = false;

	qp.onDidChangeValue(value => {
		internalUpdate = true;
		const filtered = filterLines(value);
		qp.items = toQuickPickItems(filtered, value);
		if (qp.items.length > 0) {
			const nearestItem = qp.items[findNearest(qp.items)];
			qp.activeItems = [nearestItem];
			const pos = new vscode.Position(nearestItem._lineNumber, 0);
			editor.selection = new vscode.Selection(pos, pos);
			editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
		}
		updateFastFuzzyDecorations(editor, value, filtered);
		internalUpdate = false;
	});

	qp.onDidChangeActive(items => {
		if (internalUpdate || items.length === 0) return;
		const lineNumber = items[0]._lineNumber;
		const pos = new vscode.Position(lineNumber, 0);
		editor.selection = new vscode.Selection(pos, pos);
		editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
	});

	qp.onDidAccept(() => {
		qpAccepted = true;
		qpAccepted = true;
		editor.setDecorations(matchDecorationType, []);
		const items = qp.activeItems;
		if (items.length > 0) {
			const lineNumber = items[0]._lineNumber;
			const lineText = doc.lineAt(lineNumber).text;
			const searchWords = (qp.value || "").toLowerCase().trim().split(/\s+/).filter(w => w.length > 0);

			let col = 0;
			if (searchWords.length > 0) {
				const pos = findFirstMatchPosition(lineText, [], searchWords);
				if (pos >= 0) col = pos;
			}

			const finalPos = new vscode.Position(lineNumber, col);
			editor.selection = new vscode.Selection(finalPos, finalPos);
			editor.revealRange(new vscode.Range(finalPos, finalPos), vscode.TextEditorRevealType.InCenter);
		}
		qp.dispose();
	});

	qp.onDidHide(() => {
		activeQp = null;
		editor.setDecorations(matchDecorationType, []);
		if (!qpAccepted) {
			editor.selection = originalSelection;
			editor.revealRange(
				new vscode.Range(originalSelection.active, originalSelection.active),
				vscode.TextEditorRevealType.InCenter
			);
		}
		qp.dispose();
	});

	qp.show();
}

// ── Activation ──────────────────────────────────────────────────────────

function activate(context) {
	matchDecorationType = vscode.window.createTextEditorDecorationType({
		backgroundColor: new vscode.ThemeColor("editor.findMatchHighlightBackground"),
		borderRadius: "2px"
	});

	context.subscriptions.push(
		vscode.commands.registerCommand("fuzzySearch.fastQuickFuzzy", () => showFastQuickFuzzy()),
		vscode.commands.registerCommand("fuzzySearch.acceptSplitRight", async () => {
			if (!activeQp) return;
			qpAccepted = true;
			activeQp.dispose();
			await vscode.commands.executeCommand("workbench.action.splitEditorRight");
		}),
		vscode.commands.registerCommand("fuzzySearch.acceptSplitInGroup", async () => {
			if (!activeQp) return;
			qpAccepted = true;
			activeQp.dispose();
			await vscode.commands.executeCommand("workbench.action.splitEditorInGroup");
		})
	);
}

module.exports = { activate };
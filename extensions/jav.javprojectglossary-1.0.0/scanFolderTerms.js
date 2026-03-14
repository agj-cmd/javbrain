const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { collectGlossaryFiles } = require('./glossaryUtils');

const USAGE_DATA_KEY = 'javProjectGlossary.usageData';

function createScanFolderTermsCommand(context) {
  return async function scanFolderTerms(uri) {
    // Get folder path from context menu or prompt
    let folderPath;
    if (uri && uri.fsPath) {
      folderPath = uri.fsPath;
    } else {
      const picked = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        title: 'Select folder to scan'
      });
      if (!picked?.length) return;
      folderPath = picked[0].fsPath;
    }

    const stat = fs.statSync(folderPath);
    if (!stat.isDirectory()) {
      vscode.window.showErrorMessage('Selected path is not a folder.');
      return;
    }

    // Get glossary terms
    const config = vscode.workspace.getConfiguration('javProjectGlossary');
    const inputFiles = config.get('inputFiles');

    if (!inputFiles?.length) {
      vscode.window.showWarningMessage('No glossary files configured.');
      return;
    }

    const normalizedInputFiles = inputFiles.map(p => path.normalize(p));
    const glossaryFiles = collectGlossaryFiles(normalizedInputFiles);

    if (!glossaryFiles.length) {
      vscode.window.showErrorMessage('No glossary files found.');
      return;
    }

    // Collect all terms
    const terms = [];
    for (const gp of glossaryFiles) {
      if (!fs.existsSync(gp)) continue;
      try {
        for (const line of fs.readFileSync(gp, 'utf8').split(/\r?\n/).filter(Boolean)) {
          const term = line.split(/:(.+)/)[0].trim().toLowerCase();
          if (term) terms.push(term);
        }
      } catch (err) {
        console.error('[scanFolderTerms] Error reading glossary:', gp, err.message);
      }
    }

    if (!terms.length) {
      vscode.window.showInformationMessage('No glossary terms found.');
      return;
    }

    // Build regex
    const escaped = terms
      .sort((a, b) => b.length - a.length)
      .map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi');

    // Collect files to scan
    const filesToScan = [];
    const walk = (dir) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walk(fullPath);
          } else if (entry.isFile() && (fullPath.endsWith('.txt') || fullPath.endsWith('.md'))) {
            filesToScan.push(fullPath);
          }
        }
      } catch (err) {
        console.error('[scanFolderTerms] Error walking:', dir, err.message);
      }
    };
    walk(folderPath);

    if (!filesToScan.length) {
      vscode.window.showInformationMessage('No .txt or .md files found in folder.');
      return;
    }

    // Scan files and count term occurrences
    const termCounts = new Map();

    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Scanning for glossary terms',
      cancellable: true
    }, async (progress, token) => {
      for (let i = 0; i < filesToScan.length; i++) {
        if (token.isCancellationRequested) break;

        const file = filesToScan[i];
        progress.report({
          increment: (100 / filesToScan.length),
          message: `${i + 1}/${filesToScan.length} files`
        });

        try {
          const content = fs.readFileSync(file, 'utf8');
          let match;
          while ((match = regex.exec(content)) !== null) {
            const term = match[1].toLowerCase();
            termCounts.set(term, (termCounts.get(term) || 0) + 1);
          }
        } catch (err) {
          console.error('[scanFolderTerms] Error reading file:', file, err.message);
        }
      }
    });

    // Update usage data
    const usageData = context.globalState.get(USAGE_DATA_KEY, {});
    let totalUpdated = 0;

    for (const [term, count] of termCounts) {
      const existing = usageData[term] || { count: 0, lastUsed: 0 };
      usageData[term] = {
        count: existing.count + count,
        lastUsed: Date.now()
      };
      totalUpdated += count;
    }

    await context.globalState.update(USAGE_DATA_KEY, usageData);

    // Show summary
    const uniqueTerms = termCounts.size;
    vscode.window.showInformationMessage(
      `Scan complete: ${totalUpdated} occurrences of ${uniqueTerms} terms in ${filesToScan.length} files.`
    );
  };
}

module.exports = { createScanFolderTermsCommand };
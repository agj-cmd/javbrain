// fileLoader.js
const fs = require('fs');
const path = require('path');
const vscode = require('vscode');

function resolvePath(p) {
  if (!p) return p;

  // ${execDir} prefix → resolve from executable location
  if (p.includes('${execDir}')) {
    const execDir = path.dirname(process.execPath);
    return p.replace(/\$\{execDir\}/g, execDir);
  }

  // absolute → use as-is
  if (path.isAbsolute(p)) return p;

  // plain relative → resolve from workspace root
  const folders = vscode.workspace.workspaceFolders;
  if (folders && folders.length) {
    return path.join(folders[0].uri.fsPath, p);
  }

  return p;
}

function loadList(targetPath) {
  targetPath = resolvePath(targetPath);
  const out = [];
  try {
    if (targetPath && fs.existsSync(targetPath)) {
      const stat = fs.statSync(targetPath);
      if (stat.isDirectory()) {
        for (const entry of fs.readdirSync(targetPath)) {
          out.push(...loadList(require('path').join(targetPath, entry)));
        }
      } else {
        out.push(
          ...fs
            .readFileSync(targetPath, 'utf8')
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(Boolean)
            .map(line => line.split(':')[0].trim())
            .filter(term => /^[\p{L}]/u.test(term.replace(/^\*|\*$/g, '')))
        );
      }
    }
  } catch (_) {}
  return out;
}


module.exports = { loadList, resolvePath };
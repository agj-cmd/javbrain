const fs = require('fs');
const path = require('path');
const vscode = require('vscode');

function resolvePath(p) {
  // Absolute path → as-is
  if (path.isAbsolute(p)) {
    return path.normalize(p);
  }

  // ${execDir} prefix → resolve from portable install dir
  const execDirToken = '${execDir}';
  if (p.startsWith(execDirToken)) {
    const remainder = p.slice(execDirToken.length);
    return path.normalize(path.join(path.dirname(process.execPath), remainder));
  }

  // Plain relative → resolve from workspace root
  const folders = vscode.workspace.workspaceFolders;
  if (folders && folders.length > 0) {
    return path.normalize(path.join(folders[0].uri.fsPath, p));
  }

  // No workspace open — return normalized as-is, will likely fail downstream
  return path.normalize(p);
}

function collectGlossaryFiles(paths) {
  const allFiles = [];

  for (const p of paths) {
    const normalizedPath = resolvePath(p);

    try {
      if (!fs.existsSync(normalizedPath)) {
        console.warn('[collectGlossaryFiles] Path does not exist:', normalizedPath);
        continue;
      }

      const stat = fs.statSync(normalizedPath);

      if (stat.isFile()) {
        allFiles.push(normalizedPath);
      } else if (stat.isDirectory()) {
        const walk = dir => {
          try {
            const normalizedDir = path.normalize(dir);

            if (!fs.existsSync(normalizedDir)) {
              console.error('[collectGlossaryFiles] Directory does not exist:', normalizedDir);
              return;
            }

            const entries = fs.readdirSync(normalizedDir, { withFileTypes: true });

            for (const entry of entries) {
              const fullPath = path.normalize(path.join(normalizedDir, entry.name));

              try {
                // Re-verify type using fs.statSync for reliability
                const entryStat = fs.statSync(fullPath);

                if (entryStat.isFile() && (fullPath.endsWith('.txt') || fullPath.endsWith('.md') || fullPath.endsWith('.jav'))) {
                  allFiles.push(fullPath);
                } else if (entryStat.isDirectory()) {
                  walk(fullPath);
                }
              } catch (err) {
                console.error('[collectGlossaryFiles] Error processing:', fullPath, err.message);
                continue;
              }
            }
          } catch (err) {
            console.error('[collectGlossaryFiles] Error reading directory:', dir, err.message);
          }
        };
        walk(normalizedPath);
      }
    } catch (err) {
      console.error('[collectGlossaryFiles] Error processing path:', normalizedPath, err.message);
    }
  }

  console.log('[collectGlossaryFiles] Total files found:', allFiles.length);
  return allFiles;
}

module.exports = { collectGlossaryFiles, resolvePath };
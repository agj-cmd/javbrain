// fileLoader.js
const fs = require('fs');

function loadList(targetPath) {
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


module.exports = { loadList };

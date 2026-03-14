/**
 * Converts markdown-style # headers into .jav bracketed structure.
 * Only touches header lines. All other content passes through unchanged.
 */
function mdToJav(text) {
    const lines = text.split('\n').map(l => l.replace(/\r$/, ''));
    const result = [];
    const openLevels = []; // stack of heading depths currently open

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);

        if (headerMatch) {
            const level = headerMatch[1].length; // 1-6
            const title = headerMatch[2].trim();

            // Close any sections at same or deeper level
            while (openLevels.length > 0 && openLevels[openLevels.length - 1] >= level) {
                openLevels.pop();
                const indent = '\t'.repeat(openLevels.length);
                result.push(indent + ']');
            }

            // Blank line before header (unless start of file)
            if (result.length > 0 && result[result.length - 1] !== '') {
                result.push('');
            }

            const indent = '\t'.repeat(openLevels.length);
            result.push(indent + title + ' [');
            openLevels.push(level);
        } else {
            // Non-header line: indent to current depth, pass through as-is
            if (openLevels.length > 0) {
                const indent = '\t'.repeat(openLevels.length);
                // Preserve blank lines without adding trailing whitespace
                if (line.trim() === '') {
                    result.push('');
                } else {
                    result.push(indent + line.trim());
                }
            } else {
                result.push(line);
            }
        }
    }

    // Close all remaining open sections
    while (openLevels.length > 0) {
        openLevels.pop();
        const indent = '\t'.repeat(openLevels.length);
        result.push(indent + ']');
    }

    return result.join('\n');
}

module.exports = { mdToJav };
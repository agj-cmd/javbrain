const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { collectGlossaryFiles } = require('./glossaryUtils');

/**
 * Extract entity terms from glossary inputFiles filtered by tags.
 * Each column config is an array of tag strings.
 * Glossary lines use format: Term::description words
 * A term matches a column if any of the column's tags appear as words in the description.
 * Returns object with terms array.
 */
function extractEntityTerms(tags) {
  const terms = [];
  if (!Array.isArray(tags) || tags.length === 0) return { terms };

  const config = vscode.workspace.getConfiguration('javProjectGlossary');
  const inputPaths = config.get('inputFiles') || [];
  if (inputPaths.length === 0) return { terms };

  const files = collectGlossaryFiles(inputPaths);

  // Build lowercase tag set for matching
  const tagSet = new Set(tags.map(t => t.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()).filter(Boolean));

  for (const filePath of files) {
    const normalizedPath = path.normalize(filePath);
    if (!fs.existsSync(normalizedPath)) continue;

    try {
      const content = fs.readFileSync(normalizedPath, 'utf8');
      for (const line of content.split(/\r?\n/).filter(Boolean)) {
        const sepIdx = line.indexOf('::');
        if (sepIdx === -1) continue;

        const term = line.slice(0, sepIdx).trim();
        const description = line.slice(sepIdx + 2).trim();
        if (!term || !description) continue;

        // Split description into words, strip punctuation, check against tags
        const descWords = description.split(/\s+/).map(w => w.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()).filter(Boolean);
        if (descWords.some(w => tagSet.has(w))) {
          terms.push(term);
        }
      }
    } catch (err) {
      console.error('[extractEntityTerms] Error reading glossary file:', normalizedPath, err.message);
    }
  }

  return { terms };
}

/**
 * Extract title (first non-empty line)
 */
function extractTitle(content) {
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed) return trimmed;
  }
  return '';
}

/**
 * Calculate word count and reading time
 */
function calculateWordStats(content, wpm = 240) {
  // Count words by splitting on whitespace and filtering empty strings
  const words = content.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  // Calculate reading time in minutes
  const readingTimeMinutes = Math.ceil(wordCount / wpm);

  return {
    wordCount,
    readingTime: readingTimeMinutes
  };
}

/**
 * Find matching entity terms in content
 */
function findMatchingEntities(content, terms) {
  if (!terms.length) return [];

  const escaped = terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi');

  // Find matching terms, preserve glossary case
  const matchedTerms = new Map(); // lowercase -> original case from glossary

  // Build map of lowercase to original glossary term
  for (const term of terms) {
    const lower = term.toLowerCase();
    if (!matchedTerms.has(lower)) {
      matchedTerms.set(lower, term);
    }
  }

  // Find matches in content
  const foundTerms = new Set();
  let match;
  while ((match = regex.exec(content)) !== null) {
    const matchedText = match[1];
    const lower = matchedText.toLowerCase();
    // Use the glossary version (preserves original case)
    if (matchedTerms.has(lower)) {
      foundTerms.add(matchedTerms.get(lower));
    }
  }

  return Array.from(foundTerms);
}

/**
 * Get data for specified file paths
 */
function getFilesData(filePaths, entityConfig, wpm = 240) {
  const filesData = [];

  // Prepare entity terms for each column
  const entityColumns = {};
  if (entityConfig && typeof entityConfig === 'object') {
    for (const [columnName, columnConfig] of Object.entries(entityConfig)) {
      entityColumns[columnName] = extractEntityTerms(columnConfig);
    }
  }

  for (const filePath of filePaths) {
    const normalizedPath = path.normalize(filePath);

    if (!fs.existsSync(normalizedPath)) {
      console.warn('[getFilesData] File not found:', normalizedPath);
      continue;
    }

    // Check if file is .txt or .jav
    const ext = path.extname(normalizedPath).toLowerCase();
    if (ext !== '.txt' && ext !== '.jav') continue;

    try {
      const content = fs.readFileSync(normalizedPath, 'utf8');

      const wordStats = calculateWordStats(content, wpm);

      const fileData = {
        filename: path.basename(normalizedPath),
        fullPath: normalizedPath,
        title: extractTitle(content),
        wordCount: wordStats.wordCount,
        readingTime: wordStats.readingTime,
        entities: {}
      };

      // Extract entities for each configured column
      for (const [columnName, { terms }] of Object.entries(entityColumns)) {
        fileData.entities[columnName] = findMatchingEntities(content, terms);
      }

      filesData.push(fileData);
    } catch (err) {
      console.error('[getFilesData] Error processing file:', normalizedPath, err.message);
    }
  }

  return filesData;
}

/**
 * Generate HTML for the webview
 */
function getWebviewContent(filesData, entityColumnsInfo) {
  const entityColumnNames = Object.keys(entityColumnsInfo);

  const tableRows = filesData.map((file, idx) => {
    const entityCells = entityColumnNames.map(colName => {
      const entities = file.entities[colName] || [];

      let cellContent;
      if (entities.length === 0) {
        cellContent = '<div class="cell-content">-</div>';
      } else {
        const content = escapeHtml(entities.join(', '));
        cellContent = `<div class="cell-content">${content}</div>`;
      }

      return `<td class="entity-cell" data-col="${escapeHtml(colName)}">${cellContent}</td>`;
    }).join('');

    const titleContent = escapeHtml(file.title);
    const filenameContent = escapeHtml(file.filename);
    const wordStatsContent = `${file.wordCount.toLocaleString()} words / ${file.readingTime} min`;

    return `
      <tr data-index="${idx}" data-path="${escapeHtml(file.fullPath)}" data-wordcount="${file.wordCount}" data-readingtime="${file.readingTime}">
        <td class="filename-cell" data-path="${escapeHtml(file.fullPath)}" data-col="Filename">
          <div class="cell-content">${filenameContent}</div>
        </td>
        <td class="title-cell" data-col="Title">
          <div class="cell-content">${titleContent}</div>
        </td>
        <td class="stats-cell" data-col="Stats">
          <div class="cell-content">${wordStatsContent}</div>
        </td>
        ${entityCells}
      </tr>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Files Dashboard</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

body {
  font-family: var(--vscode-editor-font-family);
  font-size: var(--vscode-editor-font-size);
  font-weight: var(--vscode-editor-font-weight);
  color: var(--vscode-editor-foreground);
  background-color: var(--vscode-editor-background);
  padding: 0;
  margin: 0;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

body:focus-within {
  opacity: 1;
}
    .header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 8px;
      border-bottom: 1px solid var(--vscode-panel-border);
      background-color: var(--vscode-editor-background);
      flex-shrink: 0;
    }

    .header-buttons {
      display: flex;
      gap: 4px;
      align-items: center;
    }

    .compact-btn {
      padding: 0;
      font-size: 11px;
      background: transparent;
      color: var(--vscode-descriptionForeground);
      border: none;
      cursor: pointer;
      border-radius: 0;
    }

    .compact-btn:hover {
      background: transparent;
      color: var(--vscode-foreground);
      text-decoration: underline;
    }

    .search-box {
      flex: 1;
      max-width: 400px;
      padding: 1px 4px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 0;
      font-size: var(--vscode-editor-font-size);
    }

    .file-count {
      color: var(--vscode-descriptionForeground);
      font-size: var(--vscode-editor-font-size);
      white-space: nowrap;
      margin-left: auto;
    }

    .column-toggles {
      display: flex;
      gap: 3px;
      padding: 2px 8px;
      border-bottom: 1px solid var(--vscode-panel-border);
      background-color: var(--vscode-editor-background);
      flex-shrink: 0;
      flex-wrap: wrap;
    }

    .column-toggle-btn {
      padding: 1px 4px;
      font-size: 11px;
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: 1px solid var(--vscode-button-border);
      cursor: pointer;
      border-radius: 0;
      white-space: nowrap;
    }

    .column-toggle-btn:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }

    .column-toggle-btn.hidden-col {
      opacity: 0.5;
      text-decoration: line-through;
    }

    .column-toggle-btn.wide-col {
      font-weight: bold;
      outline: 1px solid var(--vscode-focusBorder);
    }

    .column-toggle-btn.narrow-col {
      opacity: 0.7;
      outline: 1px dashed var(--vscode-descriptionForeground);
    }

    .table-container {
      flex: 1;
      overflow: auto;
      margin: 0;
      border: none;
      border-radius: 0;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }

    th {
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      font-weight: 600;
      text-align: left;
      padding: 2px 4px;
      border-bottom: 1px solid var(--vscode-panel-border);
      position: sticky;
      top: 0;
      white-space: normal;
      word-wrap: break-word;
      z-index: 1;
    }

    th.hidden-column {
      display: none;
    }



    td {
      padding: 1px 4px;
      border-bottom: 1px solid var(--vscode-panel-border);
      overflow: hidden;
      position: relative;
      white-space: normal;
      word-wrap: break-word;
    }

    td.hidden-column {
      display: none;
    }

    .cell-content {
      overflow: hidden;
      word-wrap: break-word;
    }

    .cell-content.scrollable {
      overflow: auto;
      outline: 2px solid var(--vscode-focusBorder);
      outline-offset: -2px;
    }

    .filename-cell {
      cursor: pointer;
      color: var(--vscode-textLink-foreground);
    }

    .filename-cell:hover {
      text-decoration: underline;
    }

    .title-cell {
      font-size: var(--vscode-editor-font-size);
      color: var(--vscode-editor-foreground);
    }

    .stats-cell {
      font-size: var(--vscode-editor-font-size);
      color: var(--vscode-editor-foreground);
    }

    .entity-cell {
      font-size: var(--vscode-editor-font-size);
      color: var(--vscode-editor-foreground);
      opacity: 0.9;
    }

    tr.selected {
      outline: 2px solid var(--vscode-editorCursor-foreground);
      outline-offset: -2px;
    }

    tr.selected .filename-cell {
      color: inherit;
    }


    .hidden {
      display: none;
    }

    .highlight {
      background-color: var(--vscode-editor-findMatchHighlightBackground);
      color: var(--vscode-editor-foreground);
      border-radius: 0;
      padding: 0;
    }

    .no-results {
      padding: 20px;
      text-align: center;
      color: var(--vscode-descriptionForeground);
    }

    .footer {
      display: flex;
      align-items: center;
      padding: 2px 8px;
      border-top: 1px solid var(--vscode-panel-border);
      background-color: var(--vscode-editor-background);
      flex-shrink: 0;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }

    .footer-stats {
      margin-left: auto;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-buttons">
      <button id="selectFilesBtn" class="compact-btn">Select Files</button>
      <button id="refreshBtn" class="compact-btn">Refresh</button>
      <button id="syncToEditorBtn" class="compact-btn">Sync to Editor</button>
      <button id="renumberBtn" class="compact-btn">Renumber Files</button>
      <button id="resetOrderBtn" class="compact-btn">Reset Order</button>
      <button id="newFileBtn" class="compact-btn">New File</button>
    </div>
    <input type="text" class="search-box" id="searchBox" placeholder="Search... (use & for AND, | for OR, or regex)">
    <span class="file-count">Files: <span id="fileCount">${filesData.length}</span></span>
  </div>

  <div class="column-toggles" id="columnToggles">
    <button class="column-toggle-btn" data-col="Filename">Filename</button>
    <button class="column-toggle-btn" data-col="Title">Title</button>
    <button class="column-toggle-btn" data-col="Stats">Stats</button>
    ${entityColumnNames.map(name =>
      `<button class="column-toggle-btn" data-col="${escapeHtml(name)}">${escapeHtml(name)}</button>`
    ).join('')}
  </div>

  <div class="table-container">
    <table id="filesTable">
      <thead>
        <tr>
          <th data-col="Filename">Filename</th>
          <th data-col="Title">Title</th>
          <th data-col="Stats">Stats</th>
          ${entityColumnNames.map(name => `<th data-col="${escapeHtml(name)}">${escapeHtml(name)}</th>`).join('')}
        </tr>
      </thead>
      <tbody id="tableBody">
        ${tableRows}
      </tbody>
    </table>
    <div id="noResults" class="no-results hidden">No files match your search</div>
  </div>

  <div class="footer">
    <span class="footer-stats" id="footerStats">Visible: 0 files | 0 words | 0:00</span>
  </div>

  <script>
    const vscode = acquireVsCodeApi();


    window.addEventListener('blur', () => {
      document.body.classList.remove('vscode-focused');
    });

    // Initialize as focused
    document.body.classList.add('vscode-focused');

    let selectedRowIndex = -1;
    let hiddenColumns = new Set();
    let columnWeights = new Map(); // colName -> weight (0.25, 0.5, 1, 2, 3)
    let focusedCellIndex = -1; // -1 means not in cell, >= 0 means in cell at that index
    let scrollableCell = null; // Reference to currently focused scrollable cell

    // Update footer stats based on visible rows
    function updateFooterStats() {
      const visibleRows = Array.from(document.querySelectorAll('#tableBody tr'))
        .filter(row => !row.classList.contains('hidden'));

      let totalWords = 0;
      let totalTime = 0;

      for (const row of visibleRows) {
        const words = parseInt(row.dataset.wordcount || '0', 10);
        const time = parseInt(row.dataset.readingtime || '0', 10);
        totalWords += words;
        totalTime += time;
      }

      const fileCount = visibleRows.length;
      const hours = Math.floor(totalTime / 60);
      const minutes = totalTime % 60;
      const timeFormatted = hours + ':' + String(minutes).padStart(2, '0');

      const footerText = 'Visible: ' + fileCount + ' files | ' + totalWords.toLocaleString() + ' words | ' + timeFormatted;
      document.getElementById('footerStats').textContent = footerText;
    }

    // Listen for messages from extension
    window.addEventListener('message', event => {
      const message = event.data;
      switch (message.command) {
        case 'updateFile':
          updateFileRow(message.fileData, message.entityColumnsInfo);
          break;

        case 'requestState':
          // Send current state back
          const searchQuery = document.getElementById('searchBox').value;
          vscode.postMessage({
            command: 'refreshWithState',
            state: { searchQuery, hiddenColumns: Array.from(hiddenColumns) }
          });
          break;

        case 'updateData':
          // Update table data while preserving state
          updateTableData(message.filesData, message.entityColumnsInfo, message.state);
          break;

        case 'focusSearch':
          document.getElementById('searchBox').focus();
          break;

        case 'syncSelection':
          // Sync selection to match the active editor file
          if (message.filePath) {
            syncSelectionToFile(message.filePath);
          }
          break;
      }
    });

    function syncSelectionToFile(filePath) {
      const rows = Array.from(document.querySelectorAll('#tableBody tr'));
      const visibleRows = rows.filter(r => !r.classList.contains('hidden'));

      // Find the row with matching path
      for (let i = 0; i < visibleRows.length; i++) {
        if (visibleRows[i].dataset.path === filePath) {
          selectedRowIndex = i;
          updateRowSelection();
          scrollToSelectedRow();
          return;
        }
      }

      // If not found in visible rows, clear selection
      selectedRowIndex = -1;
      updateRowSelection();
    }

    function moveFileInOrder(fromIndex, toIndex) {
      const visibleRows = Array.from(document.querySelectorAll('#tableBody tr'))
        .filter(row => !row.classList.contains('hidden'));

      if (fromIndex < 0 || fromIndex >= visibleRows.length ||
          toIndex < 0 || toIndex >= visibleRows.length) {
        return;
      }

      const tableBody = document.getElementById('tableBody');
      const allRows = Array.from(tableBody.querySelectorAll('tr'));

      // Get the actual rows being moved
      const fromRow = visibleRows[fromIndex];
      const toRow = visibleRows[toIndex];

      // Find their positions in the full list
      const fromPos = allRows.indexOf(fromRow);
      const toPos = allRows.indexOf(toRow);

      // Move in DOM
      if (fromPos < toPos) {
        toRow.parentNode.insertBefore(fromRow, toRow.nextSibling);
      } else {
        toRow.parentNode.insertBefore(fromRow, toRow);
      }

      // Save the new order
      saveFileOrder();
    }

    function saveFileOrder() {
      const allRows = Array.from(document.querySelectorAll('#tableBody tr'));
      const orderedPaths = allRows.map(row => row.dataset.path);
      vscode.postMessage({
        command: 'saveFileOrder',
        order: orderedPaths
      });
    }

    function updateFileRow(fileData, entityColumnsInfo) {
      // Find the row for this file
      const rows = document.querySelectorAll('#tableBody tr');
      let targetRow = null;

      for (const row of rows) {
        if (row.dataset.path === fileData.fullPath) {
          targetRow = row;
          break;
        }
      }

      if (!targetRow) return;

      // Get the row index
      const rowIndex = targetRow.dataset.index;

      // Rebuild entity cells
      const entityColumnNames = Object.keys(entityColumnsInfo);
      const entityCells = entityColumnNames.map(colName => {
        const entities = fileData.entities[colName] || [];

        let cellContent;
        if (entities.length === 0) {
          cellContent = '<div class="cell-content">-</div>';
        } else {
          const content = escapeHtmlSimple(entities.join(', '));
          cellContent = '<div class="cell-content">' + content + '</div>';
        }

        const hiddenClass = hiddenColumns.has(colName) ? ' hidden-column' : '';
        return '<td class="entity-cell' + hiddenClass + '" data-col="' + escapeHtmlSimple(colName) + '">' + cellContent + '</td>';
      }).join('');

      const titleContent = escapeHtmlSimple(fileData.title);
      const filenameContent = escapeHtmlSimple(fileData.filename);
      const wordStatsContent = fileData.wordCount.toLocaleString() + ' words / ' + fileData.readingTime + ' min';
      const titleHidden = hiddenColumns.has('Title') ? ' hidden-column' : '';
      const filenameHidden = hiddenColumns.has('Filename') ? ' hidden-column' : '';
      const statsHidden = hiddenColumns.has('Stats') ? ' hidden-column' : '';

      // Update row HTML and data attributes
      targetRow.dataset.wordcount = fileData.wordCount;
      targetRow.dataset.readingtime = fileData.readingTime;
      targetRow.innerHTML =
        '<td class="filename-cell' + filenameHidden + '" data-path="' + escapeHtmlSimple(fileData.fullPath) + '" data-col="Filename">' +
        '<div class="cell-content">' + filenameContent + '</div>' +
        '</td>' +
        '<td class="title-cell' + titleHidden + '" data-col="Title">' +
        '<div class="cell-content">' + titleContent + '</div>' +
        '</td>' +
        '<td class="stats-cell' + statsHidden + '" data-col="Stats">' +
        '<div class="cell-content">' + wordStatsContent + '</div>' +
        '</td>' +
        entityCells;

      // Re-attach listeners
      const filenameCell = targetRow.querySelector('.filename-cell');
      if (filenameCell) {
        filenameCell.addEventListener('click', (e) => {
          vscode.postMessage({
            command: 'openFile',
            path: filenameCell.dataset.path,
            altKey: e.altKey,
            ctrlKey: e.ctrlKey || e.metaKey
          });
        });
      }

      // Re-apply search if active
      const searchBox = document.getElementById('searchBox');
      if (searchBox && searchBox.value.trim()) {
        searchBox.dispatchEvent(new Event('input'));
      }

      // Update footer stats
      updateFooterStats();
    }

    function escapeHtmlSimple(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    function updateTableData(filesData, entityColumnsInfo, state) {
      // Rebuild table body
      const tableBody = document.getElementById('tableBody');
      const entityColumnNames = Object.keys(entityColumnsInfo);

      const tableRows = filesData.map((file, idx) => {
        const entityCells = entityColumnNames.map(colName => {
          const entities = file.entities[colName] || [];

          let cellContent;
          if (entities.length === 0) {
            cellContent = '<div class="cell-content">-</div>';
          } else {
            const content = escapeHtml(entities.join(', '));
            cellContent = '<div class="cell-content">' + content + '</div>';
          }

          return '<td class="entity-cell" data-col="' + escapeHtml(colName) + '">' + cellContent + '</td>';
        }).join('');

        const titleContent = escapeHtml(file.title);
        const filenameContent = escapeHtml(file.filename);
        const wordStatsContent = file.wordCount.toLocaleString() + ' words / ' + file.readingTime + ' min';

        return '<tr data-index="' + idx + '" data-path="' + escapeHtml(file.fullPath) + '" data-wordcount="' + file.wordCount + '" data-readingtime="' + file.readingTime + '">' +
          '<td class="filename-cell" data-path="' + escapeHtml(file.fullPath) + '" data-col="Filename">' +
          '<div class="cell-content">' + filenameContent + '</div>' +
          '</td>' +
          '<td class="title-cell" data-col="Title">' +
          '<div class="cell-content">' + titleContent + '</div>' +
          '</td>' +
          '<td class="stats-cell" data-col="Stats">' +
          '<div class="cell-content">' + wordStatsContent + '</div>' +
          '</td>' +
          entityCells +
          '</tr>';
      }).join('');

      tableBody.innerHTML = tableRows;

      // Restore state
      if (state) {
        // Restore search query
        if (state.searchQuery) {
          document.getElementById('searchBox').value = state.searchQuery;
          document.getElementById('searchBox').dispatchEvent(new Event('input'));
        }

        // Restore hidden columns
        if (state.hiddenColumns && state.hiddenColumns.length > 0) {
          state.hiddenColumns.forEach(colName => {
            hiddenColumns.add(colName);
            applyColumnVisibility(colName);
          });
          updateColumnToggleButtons();
          applyColumnWidths();
        }
      }

      // Re-attach event listeners
      attachEventListeners();

      document.getElementById('fileCount').textContent = filesData.length;

      // Reset selection
      selectedRowIndex = -1;

      // Update footer stats
      updateFooterStats();
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    function attachEventListeners() {
      // Filename click - open file
      document.querySelectorAll('.filename-cell').forEach(cell => {
        cell.addEventListener('click', (e) => {
          vscode.postMessage({
            command: 'openFile',
            path: cell.dataset.path,
            altKey: e.altKey,
            ctrlKey: e.ctrlKey || e.metaKey
          });
        });
      });

      // Row click - select row
      document.querySelectorAll('#tableBody tr').forEach((row, idx) => {
        row.addEventListener('click', (e) => {
          // Don't select if clicking on filename (which opens file)
          if (e.target.closest('.filename-cell')) return;

          const visibleRows = Array.from(document.querySelectorAll('#tableBody tr'))
            .filter(r => !r.classList.contains('hidden'));

          selectedRowIndex = visibleRows.indexOf(row);
          updateRowSelection();
          scrollToSelectedRow();
        });

        // Row double-click - open file
        row.addEventListener('dblclick', (e) => {
          const path = row.dataset.path;
          if (path) {
            vscode.postMessage({
              command: 'openFile',
              path: path,
              altKey: e.altKey,
              ctrlKey: e.ctrlKey || e.metaKey
            });
          }
        });
      });
    }

    function applyColumnVisibility(colName) {
      const isHidden = hiddenColumns.has(colName);

      // Hide/show header
      const headers = document.querySelectorAll('th[data-col]');
      headers.forEach(th => {
        if (th.dataset.col === colName) {
          if (isHidden) {
            th.classList.add('hidden-column');
          } else {
            th.classList.remove('hidden-column');
          }
        }
      });

      // Hide/show cells
      const cells = document.querySelectorAll('td[data-col]');
      cells.forEach(td => {
        if (td.dataset.col === colName) {
          if (isHidden) {
            td.classList.add('hidden-column');
          } else {
            td.classList.remove('hidden-column');
          }
        }
      });
    }

    function updateColumnToggleButtons() {
      document.querySelectorAll('.column-toggle-btn').forEach(btn => {
        const colName = btn.dataset.col;
        if (hiddenColumns.has(colName)) {
          btn.classList.add('hidden-col');
        } else {
          btn.classList.remove('hidden-col');
        }
      });
    }

    // Search functionality with regex support and custom & for AND
    document.getElementById('searchBox').addEventListener('input', (e) => {
      let query = e.target.value;
      const rows = document.querySelectorAll('#tableBody tr');
      let visibleCount = 0;

      rows.forEach(row => {
        if (!query.trim()) {
          row.classList.remove('hidden');
          // Remove all highlights
          row.querySelectorAll('.highlight').forEach(el => {
            const parent = el.parentNode;
            parent.replaceChild(document.createTextNode(el.textContent), el);
            parent.normalize();
          });
          visibleCount++;
        } else {
          const text = row.textContent;
          let matches = false;
          let regex = null;
          let termsToHighlight = [];

          // Check if query uses & for AND logic
          if (query.includes('&')) {
            const terms = query.split('&').map(t => t.trim()).filter(Boolean);
            // Check if all terms are present
            matches = terms.every(term => {
              try {
                const termRegex = new RegExp(term, 'i');
                return termRegex.test(text);
              } catch (e) {
                return text.toLowerCase().includes(term.toLowerCase());
              }
            });
            termsToHighlight = terms;
          } else if (query.includes('|')) {
            const terms = query.split('|').map(t => t.trim()).filter(Boolean);
            // Check if any term is present
            matches = terms.some(term => {
              try {
                const termRegex = new RegExp(term, 'i');
                return termRegex.test(text);
              } catch (e) {
                return text.toLowerCase().includes(term.toLowerCase());
              }
            });
            termsToHighlight = terms;
          } else {
            // Try to use as regex (case-insensitive)
            try {
              regex = new RegExp(query, 'gi');
              matches = regex.test(text);
            } catch (e) {
              // If regex fails, fall back to plain text search
              matches = text.toLowerCase().includes(query.toLowerCase());
            }
          }

          if (matches) {
            row.classList.remove('hidden');
            if (termsToHighlight.length > 0) {
              highlightTerms(row, termsToHighlight);
            } else {
              highlightMatches(row, query, regex);
            }
            visibleCount++;
          } else {
            row.classList.add('hidden');
          }
        }
      });

      document.getElementById('fileCount').textContent = visibleCount;
      document.getElementById('noResults').classList.toggle('hidden', visibleCount > 0);

      // Reset selection and cell focus when search changes
      selectedRowIndex = -1;
      focusedCellIndex = -1;
      if (scrollableCell) {
        scrollableCell.classList.remove('scrollable');
        scrollableCell = null;
      }
      updateRowSelection();

      // Update footer stats
      updateFooterStats();
    });

    function highlightTerms(element, terms) {
      // Remove existing highlights first
      element.querySelectorAll('.highlight').forEach(el => {
        const parent = el.parentNode;
        parent.replaceChild(document.createTextNode(el.textContent), el);
        parent.normalize();
      });

      if (terms.length === 0) return;

      const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: function(node) {
            // Skip tooltip nodes
            if (node.parentElement && node.parentElement.classList.contains('cell-tooltip')) {
              return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_ACCEPT;
          }
        },
        false
      );

      const nodesToProcess = [];
      let node;
      while (node = walker.nextNode()) {
        nodesToProcess.push(node);
      }

      nodesToProcess.forEach(textNode => {
        const text = textNode.nodeValue;
        const fragments = [];
        let lastIndex = 0;
        const positions = [];

        // Find all term positions
        for (const term of terms) {
          try {
            const regex = new RegExp(term, 'gi');
            let match;
            while ((match = regex.exec(text)) !== null) {
              positions.push({ index: match.index, length: match[0].length });
              if (match.index === regex.lastIndex) regex.lastIndex++;
            }
          } catch (e) {
            // Fall back to plain text
            const lowerText = text.toLowerCase();
            const lowerTerm = term.toLowerCase();
            let index = lowerText.indexOf(lowerTerm);
            while (index !== -1) {
              positions.push({ index, length: term.length });
              index = lowerText.indexOf(lowerTerm, index + 1);
            }
          }
        }

        if (positions.length === 0) return;

        // Sort and merge overlapping positions
        positions.sort((a, b) => a.index - b.index);
        const merged = [];
        for (const pos of positions) {
          if (merged.length === 0 || pos.index >= merged[merged.length - 1].index + merged[merged.length - 1].length) {
            merged.push(pos);
          } else {
            const last = merged[merged.length - 1];
            const end = Math.max(last.index + last.length, pos.index + pos.length);
            last.length = end - last.index;
          }
        }

        // Create fragments with highlights
        for (const pos of merged) {
          if (pos.index > lastIndex) {
            fragments.push(document.createTextNode(text.substring(lastIndex, pos.index)));
          }
          const span = document.createElement('span');
          span.className = 'highlight';
          span.textContent = text.substring(pos.index, pos.index + pos.length);
          fragments.push(span);
          lastIndex = pos.index + pos.length;
        }

        if (lastIndex < text.length) {
          fragments.push(document.createTextNode(text.substring(lastIndex)));
        }

        if (fragments.length > 0) {
          const parent = textNode.parentNode;
          fragments.forEach(frag => parent.insertBefore(frag, textNode));
          parent.removeChild(textNode);
        }
      });
    }

    function highlightMatches(element, query, regex) {
      // Remove existing highlights first
      element.querySelectorAll('.highlight').forEach(el => {
        const parent = el.parentNode;
        parent.replaceChild(document.createTextNode(el.textContent), el);
        parent.normalize();
      });

      if (!query.trim()) return;

      // Apply new highlights
      const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: function(node) {
            // Skip tooltip nodes
            if (node.parentElement && node.parentElement.classList.contains('cell-tooltip')) {
              return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_ACCEPT;
          }
        },
        false
      );

      const nodesToProcess = [];
      let node;
      while (node = walker.nextNode()) {
        nodesToProcess.push(node);
      }

      nodesToProcess.forEach(textNode => {
        const text = textNode.nodeValue;
        const fragments = [];
        let lastIndex = 0;
        const positions = [];

        if (regex) {
          // Use regex to find matches
          regex.lastIndex = 0;
          let match;
          while ((match = regex.exec(text)) !== null) {
            positions.push({ index: match.index, length: match[0].length });
            // Prevent infinite loop on zero-length matches
            if (match.index === regex.lastIndex) {
              regex.lastIndex++;
            }
          }
        } else {
          // Fall back to plain text search
          const lowerText = text.toLowerCase();
          const lowerQuery = query.toLowerCase();
          let index = lowerText.indexOf(lowerQuery);
          while (index !== -1) {
            positions.push({ index, length: query.length });
            index = lowerText.indexOf(lowerQuery, index + 1);
          }
        }

        if (positions.length === 0) return;

        // Create fragments with highlights
        for (const pos of positions) {
          if (pos.index > lastIndex) {
            fragments.push(document.createTextNode(text.substring(lastIndex, pos.index)));
          }
          const span = document.createElement('span');
          span.className = 'highlight';
          span.textContent = text.substring(pos.index, pos.index + pos.length);
          fragments.push(span);
          lastIndex = pos.index + pos.length;
        }

        if (lastIndex < text.length) {
          fragments.push(document.createTextNode(text.substring(lastIndex)));
        }

        if (fragments.length > 0) {
          const parent = textNode.parentNode;
          fragments.forEach(frag => parent.insertBefore(frag, textNode));
          parent.removeChild(textNode);
        }
      });
    }

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      const searchBox = document.getElementById('searchBox');

      // Ctrl+F to focus search box
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        searchBox.focus();
        searchBox.select();
        return;
      }

      // Escape clears search
      if (e.key === 'Escape') {
        if (document.activeElement === searchBox) {
          e.preventDefault();
          searchBox.value = '';
          searchBox.dispatchEvent(new Event('input'));
          searchBox.blur();
          return;
        }
        if (focusedCellIndex >= 0) {
          e.preventDefault();
          exitScrollableCell();
          return;
        }
        if (searchBox.value.trim()) {
          e.preventDefault();
          searchBox.value = '';
          searchBox.dispatchEvent(new Event('input'));
          return;
        }
      }

      // If search box is focused
      if (document.activeElement === searchBox) {
        // Enter key returns focus to table and selects first visible row
        if (e.key === 'Enter') {
          e.preventDefault();
          searchBox.blur();

          const visibleRows = Array.from(document.querySelectorAll('#tableBody tr'))
            .filter(row => !row.classList.contains('hidden'));

          if (visibleRows.length > 0) {
            selectedRowIndex = 0;
            focusedCellIndex = -1;
            scrollableCell = null;
            updateRowSelection();
            scrollToSelectedRow();
          }
        }
        return;
      }

      const visibleRows = Array.from(document.querySelectorAll('#tableBody tr'))
        .filter(row => !row.classList.contains('hidden'));

      if (visibleRows.length === 0) return;

      // If we're inside a scrollable cell
      if (focusedCellIndex >= 0 && scrollableCell) {
        // Up/Down scrolls within the cell
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          scrollableCell.scrollTop -= 20;
          return;
        }

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          scrollableCell.scrollTop += 20;
          return;
        }

        // Left exits the scrollable cell
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          exitScrollableCell();
          return;
        }

        // Right does nothing when inside cell
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          return;
        }
      } else {
        // Normal row navigation mode

        // Ctrl+Arrow Up - Move file up in order
        if (e.ctrlKey && e.key === 'ArrowUp') {
          e.preventDefault();
          if (selectedRowIndex > 0) {
            moveFileInOrder(selectedRowIndex, selectedRowIndex - 1);
            selectedRowIndex--;
            updateRowSelection();
            scrollToSelectedRow();
          }
          return;
        }

        // Ctrl+Arrow Down - Move file down in order
        if (e.ctrlKey && e.key === 'ArrowDown') {
          e.preventDefault();
          if (selectedRowIndex < visibleRows.length - 1) {
            moveFileInOrder(selectedRowIndex, selectedRowIndex + 1);
            selectedRowIndex++;
            updateRowSelection();
            scrollToSelectedRow();
          }
          return;
        }

        // Arrow Up
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (selectedRowIndex > 0) {
            selectedRowIndex--;
          } else {
            selectedRowIndex = visibleRows.length - 1; // Wrap to bottom
          }
          focusedCellIndex = -1;
          scrollableCell = null;
          updateRowSelection();
          scrollToSelectedRow();
          return;
        }

        // Arrow Down
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (selectedRowIndex < visibleRows.length - 1) {
            selectedRowIndex++;
          } else {
            selectedRowIndex = 0; // Wrap to top
          }
          focusedCellIndex = -1;
          scrollableCell = null;
          updateRowSelection();
          scrollToSelectedRow();
          return;
        }

        // Right arrow - enter first scrollable cell if one exists
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          if (selectedRowIndex >= 0 && selectedRowIndex < visibleRows.length) {
            const row = visibleRows[selectedRowIndex];
            const cells = Array.from(row.querySelectorAll('td:not(.hidden-column)'));

            // Find first cell with scrollable content
            for (let i = 0; i < cells.length; i++) {
              const cellContent = cells[i].querySelector('.cell-content');
              if (cellContent && isScrollable(cellContent)) {
                focusedCellIndex = i;
                scrollableCell = cellContent;
                cellContent.classList.add('scrollable');
                cellContent.scrollTop = 0; // Reset scroll position
                break;
              }
            }
          }
          return;
        }

        // Left arrow does nothing in row mode
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          return;
        }
      }

      // Enter to open file (works in both modes)
      if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedRowIndex >= 0 && selectedRowIndex < visibleRows.length) {
          const row = visibleRows[selectedRowIndex];
          const path = row.dataset.path;
          vscode.postMessage({ command: 'openFile', path: path, altKey: e.altKey, ctrlKey: e.ctrlKey || e.metaKey });
        }
      }

      // Home/End jump to first/last row
      if (e.key === 'Home') {
        e.preventDefault();
        selectedRowIndex = 0;
        focusedCellIndex = -1;
        scrollableCell = null;
        updateRowSelection();
        scrollToSelectedRow();
        return;
      }

      if (e.key === 'End') {
        e.preventDefault();
        selectedRowIndex = visibleRows.length - 1;
        focusedCellIndex = -1;
        scrollableCell = null;
        updateRowSelection();
        scrollToSelectedRow();
        return;
      }
    });

    function isScrollable(element) {
      // Check if content is truncated (scrollHeight > clientHeight or scrollWidth > clientWidth)
      return element.scrollHeight > element.clientHeight ||
             element.scrollWidth > element.clientWidth;
    }

    function exitScrollableCell() {
      if (scrollableCell) {
        scrollableCell.classList.remove('scrollable');
      }
      focusedCellIndex = -1;
      scrollableCell = null;
    }

    function updateRowSelection() {
      const visibleRows = Array.from(document.querySelectorAll('#tableBody tr'))
        .filter(row => !row.classList.contains('hidden'));

      // Remove selected class from all rows
      document.querySelectorAll('#tableBody tr').forEach(row => {
        row.classList.remove('selected');
      });

      // Remove scrollable class from any cell
      document.querySelectorAll('.cell-content.scrollable').forEach(cell => {
        cell.classList.remove('scrollable');
      });

      // Add selected class to current row
      if (selectedRowIndex >= 0 && selectedRowIndex < visibleRows.length) {
        visibleRows[selectedRowIndex].classList.add('selected');
      }
    }

    function scrollToSelectedRow() {
      const visibleRows = Array.from(document.querySelectorAll('#tableBody tr'))
        .filter(row => !row.classList.contains('hidden'));

      if (selectedRowIndex >= 0 && selectedRowIndex < visibleRows.length) {
        const row = visibleRows[selectedRowIndex];
        row.scrollIntoView({ block: 'nearest', behavior: 'auto' });
      }
    }

    // Initial attachment of event listeners
    attachEventListeners();

    // Initial footer stats update
    updateFooterStats();

    // Refresh button
    document.getElementById('refreshBtn').addEventListener('click', () => {
      vscode.postMessage({ command: 'refresh' });
    });

    // Select Files button
    document.getElementById('selectFilesBtn').addEventListener('click', () => {
      vscode.postMessage({ command: 'selectFiles' });
    });

    // Sync to Editor button
    document.getElementById('syncToEditorBtn').addEventListener('click', () => {
      vscode.postMessage({ command: 'syncToEditor' });
    });

    // Renumber Files button
    document.getElementById('renumberBtn').addEventListener('click', () => {
      const allRows = Array.from(document.querySelectorAll('#tableBody tr'));
      const orderedPaths = allRows.map(row => row.dataset.path);
      vscode.postMessage({ command: 'renumberFiles', paths: orderedPaths });
    });

    // New File button
    document.getElementById('newFileBtn').addEventListener('click', () => {
      const visibleRows = Array.from(document.querySelectorAll('#tableBody tr'))
        .filter(row => !row.classList.contains('hidden'));
      const selectedRow = selectedRowIndex >= 0 && selectedRowIndex < visibleRows.length
        ? visibleRows[selectedRowIndex]
        : null;
      const insertAfterPath = selectedRow ? selectedRow.dataset.path : null;
      vscode.postMessage({ command: 'newFile', insertAfterPath });
    });

    // Reset Order button
    document.getElementById('resetOrderBtn').addEventListener('click', () => {
      vscode.postMessage({ command: 'resetOrder' });
    });

    // Column toggle buttons
    document.querySelectorAll('.column-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const colName = btn.dataset.col;

        if (hiddenColumns.has(colName)) {
          hiddenColumns.delete(colName);
        } else {
          hiddenColumns.add(colName);
        }

        applyColumnVisibility(colName);
        updateColumnToggleButtons();
        applyColumnWidths();
      });
    });

    // Right-click column toggle buttons to cycle width
    const weightCycle = [1, 2, 3, 0.25, 0.5];
    const weightLabels = { 0.25: '¼', 0.5: '½', 1: null, 2: '2×', 3: '3×' };

    function getColumnWeight(colName) {
      return columnWeights.get(colName) || 1;
    }

    function updateToggleButtonStyle(btn, weight) {
      btn.classList.remove('wide-col', 'narrow-col');
      // Remove any existing weight badge
      const badge = btn.querySelector('.weight-badge');
      if (badge) badge.remove();

      if (weight > 1) {
        btn.classList.add('wide-col');
      } else if (weight < 1) {
        btn.classList.add('narrow-col');
      }

      const label = weightLabels[weight];
      if (label) {
        const span = document.createElement('span');
        span.className = 'weight-badge';
        span.textContent = ' ' + label;
        btn.appendChild(span);
      }
    }

    document.querySelectorAll('.column-toggle-btn').forEach(btn => {
      btn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const colName = btn.dataset.col;
        if (hiddenColumns.has(colName)) return;

        const current = getColumnWeight(colName);
        const idx = weightCycle.indexOf(current);
        const next = weightCycle[(idx + 1) % weightCycle.length];

        if (next === 1) {
          columnWeights.delete(colName);
        } else {
          columnWeights.set(colName, next);
        }

        updateToggleButtonStyle(btn, next);
        applyColumnWidths();
      });
    });

    function applyColumnWidths() {
      const ths = Array.from(document.querySelectorAll('th[data-col]'));
      const visibleThs = ths.filter(th => !th.classList.contains('hidden-column'));

      let totalWeight = 0;
      for (const th of visibleThs) {
        totalWeight += getColumnWeight(th.dataset.col);
      }

      for (const th of ths) {
        if (th.classList.contains('hidden-column')) {
          th.style.width = '';
          continue;
        }
        const weight = getColumnWeight(th.dataset.col);
        th.style.width = ((weight / totalWeight) * 100) + '%';
      }
    }

    // Initial equal sizing
    applyColumnWidths();
  </script>
</body>
</html>`;
}

function escapeHtml(text) {
  const div = { textContent: text };
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Create the dashboard command
 */
function createDashboardCommand(context) {
  let currentPanel = undefined;
  let currentFilePaths = [];
  const SAVED_REGEXES_KEY = 'javProjectGlossary.savedRegexes';
  const LAST_SELECTED_FILES_KEY = 'javProjectGlossary.lastSelectedFiles'; // Changed to workspaceState
  const FILE_ORDER_KEY = 'javProjectGlossary.fileOrder';

  return async function openDashboard() {
    const config = vscode.workspace.getConfiguration('javProjectGlossary');
    const entityConfig = config.get('entityColumns') || {};

    if (currentPanel) {
      currentPanel.reveal();
      return;
    }

    currentPanel = vscode.window.createWebviewPanel(
      'javFilesDashboard',
      'Files Dashboard',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    // Load last selected files from WORKSPACE state (not global)
    const lastFiles = context.workspaceState.get(LAST_SELECTED_FILES_KEY, []);
    if (lastFiles.length > 0) {
      currentFilePaths = lastFiles
        .map(f => path.normalize(f))
        .filter(f => fs.existsSync(f));
    }

    // Apply saved file order if available
    const savedOrder = context.workspaceState.get(FILE_ORDER_KEY, []);
    if (savedOrder.length > 0 && currentFilePaths.length > 0) {
      // Reorder currentFilePaths to match savedOrder
      const orderedPaths = [];
      const pathSet = new Set(currentFilePaths);

      // Add files in saved order
      for (const p of savedOrder) {
        const normalized = path.normalize(p);
        if (pathSet.has(normalized)) {
          orderedPaths.push(normalized);
          pathSet.delete(normalized);
        }
      }

      // Add any new files not in saved order at the end
      orderedPaths.push(...Array.from(pathSet));

      currentFilePaths = orderedPaths;
    }

    function updateWebview() {
      const wpm = config.get('readingWPM') || 240;
      const filesData = getFilesData(currentFilePaths, entityConfig, wpm);

      // Build entityColumnsInfo
      const entityColumnsInfo = {};
      for (const columnName of Object.keys(entityConfig)) {
        entityColumnsInfo[columnName] = {};
      }

      currentPanel.webview.html = getWebviewContent(filesData, entityColumnsInfo);
    }

    updateWebview();

    // Set up file watchers for auto-refresh
    let fileWatchers = [];

    function setupFileWatchers() {
      // Clear existing watchers
      fileWatchers.forEach(watcher => {
        fs.unwatchFile(watcher.path);
      });
      fileWatchers = [];

      // Watch each selected file
      for (const filePath of currentFilePaths) {
        const normalizedPath = path.normalize(filePath);

        if (!fs.existsSync(normalizedPath)) continue;

        const watcher = {
          path: normalizedPath,
          handler: (curr, prev) => {
            if (curr.mtime !== prev.mtime) {
              // File changed, update just this row
              const content = fs.readFileSync(normalizedPath, 'utf8');
              const wpm = config.get('readingWPM') || 240;
              const wordStats = calculateWordStats(content, wpm);

              const fileData = {
                filename: path.basename(normalizedPath),
                fullPath: normalizedPath,
                title: extractTitle(content),
                wordCount: wordStats.wordCount,
                readingTime: wordStats.readingTime,
                entities: {}
              };

              // Extract entities for each column
              for (const [columnName, columnTags] of Object.entries(entityConfig)) {
                const { terms } = extractEntityTerms(columnTags);
                fileData.entities[columnName] = findMatchingEntities(content, terms);
              }

              // Build entityColumnsInfo
              const entityColumnsInfo = {};
              for (const columnName of Object.keys(entityConfig)) {
                entityColumnsInfo[columnName] = {};
              }

              // Send update message to webview
              currentPanel.webview.postMessage({
                command: 'updateFile',
                fileData: fileData,
                entityColumnsInfo: entityColumnsInfo
              });
            }
          }
        };

        fs.watchFile(normalizedPath, { interval: 1000 }, watcher.handler);
        fileWatchers.push(watcher);
      }
    }

    setupFileWatchers();

    // Auto-sync selection when active editor changes
    const editorChangeListener = vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor && currentPanel) {
        const activeFilePath = path.normalize(editor.document.uri.fsPath);
        // Check if this file is in our dashboard
        if (currentFilePaths.includes(activeFilePath)) {
          currentPanel.webview.postMessage({
            command: 'syncSelection',
            filePath: activeFilePath
          });
        }
      }
    });

    context.subscriptions.push(editorChangeListener);

    currentPanel.webview.onDidReceiveMessage(
      async message => {
        switch (message.command) {
          case 'openFile':
            const uri = vscode.Uri.file(message.path);

            // Determine target view column based on modifier keys
            let targetColumn;

            if (message.altKey) {
              // Alt: Open in same group as dashboard
              targetColumn = currentPanel.viewColumn;
            } else if (message.ctrlKey) {
              // Ctrl/Cmd: Open to the right (Beside)
              targetColumn = vscode.ViewColumn.Beside;
            } else {
              // Default: Open in first group
              targetColumn = vscode.ViewColumn.One;
            }

            // Check all tab groups for this file
            let foundTab = null;
            let foundGroup = null;

            for (const tabGroup of vscode.window.tabGroups.all) {
              for (const tab of tabGroup.tabs) {
                if (tab.input instanceof vscode.TabInputText) {
                  if (tab.input.uri.fsPath === message.path) {
                    foundTab = tab;
                    foundGroup = tabGroup;
                    break;
                  }
                }
              }
              if (foundTab) break;
            }

            if (foundTab && foundGroup) {
              // File is already open in a tab, reveal it
              const doc = await vscode.workspace.openTextDocument(uri);
              await vscode.window.showTextDocument(doc, {
                viewColumn: foundGroup.viewColumn,
                preserveFocus: false,
                preview: false
              });
            } else {
              // File not open, open it in the determined view column
              const doc = await vscode.workspace.openTextDocument(uri);
              await vscode.window.showTextDocument(doc, {
                viewColumn: targetColumn,
                preview: false
              });
            }
            break;

          case 'refresh':
            // Request current state from webview
            currentPanel.webview.postMessage({ command: 'requestState' });
            break;

          case 'refreshWithState':
            // Refresh data and send back with state
            const wpm = config.get('readingWPM') || 240;
            const filesData = getFilesData(currentFilePaths, entityConfig, wpm);
            const entityColumnsInfo = {};
            for (const columnName of Object.keys(entityConfig)) {
              entityColumnsInfo[columnName] = {};
            }
            currentPanel.webview.postMessage({
              command: 'updateData',
              filesData: filesData,
              entityColumnsInfo: entityColumnsInfo,
              state: message.state
            });
            break;

          case 'selectFiles':
            await handleFileSelection(context, entityConfig);
            break;

          case 'syncToEditor':
            // Get the active text editor's file path
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor) {
              const activeFilePath = path.normalize(activeEditor.document.uri.fsPath);
              // Send the path to the webview to sync selection
              currentPanel.webview.postMessage({
                command: 'syncSelection',
                filePath: activeFilePath
              });
            }
            break;

          case 'saveFileOrder':
            // Save the file order to workspace state
            await context.workspaceState.update(FILE_ORDER_KEY, message.order);
            // Update currentFilePaths to match the new order
            currentFilePaths = message.order.map(p => path.normalize(p));
            break;

          case 'resetOrder':
            // Sort files alphabetically by full path and clear saved order
            currentFilePaths.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
            await context.workspaceState.update(FILE_ORDER_KEY, currentFilePaths);
            await context.workspaceState.update(LAST_SELECTED_FILES_KEY, currentFilePaths);
            currentPanel.webview.postMessage({ command: 'requestState' });
            break;

          case 'renumberFiles':
            await handleRenumberFiles(message.paths);
            break;

          case 'newFile':
            await handleNewFile(message.insertAfterPath);
            break;
        }
      },
      undefined,
      context.subscriptions
    );

    currentPanel.onDidDispose(
      () => {
        // Clean up file watchers
        fileWatchers.forEach(watcher => {
          fs.unwatchFile(watcher.path);
        });
        fileWatchers = [];

        // Clean up editor change listener
        editorChangeListener.dispose();

        currentPanel = undefined;
      },
      null,
      context.subscriptions
    );

    async function handleRenumberFiles(filePaths) {
      try {
        // Normalize all paths first
        const normalizedPaths = filePaths.map(p => path.normalize(p));

        // Step 1: Generate new names (strip prefix and add new numbers)
        const renameMap = [];

        for (let i = 0; i < normalizedPaths.length; i++) {
          const oldPath = normalizedPaths[i];
          const dir = path.dirname(oldPath);
          const fullName = path.basename(oldPath);
          const ext = path.extname(fullName);

          // Strip everything before and including first underscore
          let baseName = fullName;
          const underscoreIndex = fullName.indexOf('_');
          if (underscoreIndex !== -1) {
            baseName = fullName.substring(underscoreIndex + 1);
          }

          // Remove extension from baseName if present
          if (ext) {
            baseName = baseName.substring(0, baseName.length - ext.length);
          }

          // Create new name with padded number
          const newNumber = String(i + 1).padStart(3, '0');
          const newName = `${newNumber}_${baseName}${ext}`;
          const newPath = path.normalize(path.join(dir, newName));

          renameMap.push({ oldPath, newPath, newName });
        }

        // Step 2: Show confirmation
        const previewLines = renameMap.map((r, i) =>
          `${i + 1}. ${path.basename(r.oldPath)} → ${r.newName}`
        );
        const previewFirst10 = previewLines.slice(0, 10).join('\n');
        const hasMore = renameMap.length > 10;
        const previewText = hasMore ? previewFirst10 + '\n...' : previewFirst10;

        const confirmMessage = `Renumber ${normalizedPaths.length} files?\n\nPreview (first 10):\n${previewText}`;

        const confirm = await vscode.window.showInformationMessage(
          confirmMessage,
          { modal: true },
          'Renumber',
          'Cancel'
        );

        if (confirm !== 'Renumber') return;

        // Step 3: Temp rename all files first (to avoid conflicts)
        const tempMap = [];
        for (let i = 0; i < renameMap.length; i++) {
          const { oldPath } = renameMap[i];
          const dir = path.dirname(oldPath);
          const tempName = `__temp_rename_${i}__${path.basename(oldPath)}`;
          const tempPath = path.normalize(path.join(dir, tempName));

          fs.renameSync(oldPath, tempPath);
          tempMap.push({ tempPath, finalPath: renameMap[i].newPath });
        }

        // Step 4: Rename from temp to final names
        for (const { tempPath, finalPath } of tempMap) {
          fs.renameSync(tempPath, finalPath);
        }

        // Step 5: Update currentFilePaths and refresh
        currentFilePaths = renameMap.map(r => r.newPath);
        await context.workspaceState.update(LAST_SELECTED_FILES_KEY, currentFilePaths);
        await context.workspaceState.update(FILE_ORDER_KEY, currentFilePaths);

        // Refresh the webview
        currentPanel.webview.postMessage({ command: 'requestState' });

        vscode.window.showInformationMessage(`Successfully renumbered ${normalizedPaths.length} files.`);

      } catch (error) {
        vscode.window.showErrorMessage(`Failed to renumber files: ${error.message}`);
      }
    }

    async function handleNewFile(insertAfterPath) {
      try {
        // Prompt for filename
        const filename = await vscode.window.showInputBox({
          prompt: 'Enter filename (with extension)',
          placeHolder: 'newfile.txt',
          validateInput: (value) => {
            if (!value || !value.trim()) return 'Filename cannot be empty';
            if (value.includes('/') || value.includes('\\')) return 'Filename cannot contain path separators';
            return null;
          }
        });

        if (!filename) return;

        // Determine directory from existing files or prompt
        let targetDir;
        if (currentFilePaths.length > 0) {
          // Use directory of first file (or insertAfter file if specified)
          const refPath = insertAfterPath
            ? path.normalize(insertAfterPath)
            : currentFilePaths[0];
          targetDir = path.dirname(refPath);
        } else {
          // No files yet, prompt for directory
          const uris = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'Select Folder'
          });

          if (!uris || uris.length === 0) return;
          targetDir = path.normalize(uris[0].fsPath);
        }

        // Create file path
        const newFilePath = path.normalize(path.join(targetDir, filename.trim()));

        // Check if file already exists
        if (fs.existsSync(newFilePath)) {
          vscode.window.showErrorMessage(`File already exists: ${filename.trim()}`);
          return;
        }

        // Create empty file
        fs.writeFileSync(newFilePath, '');

        // Add to currentFilePaths at the right position
        if (insertAfterPath) {
          const normalizedInsertPath = path.normalize(insertAfterPath);
          const insertIndex = currentFilePaths.indexOf(normalizedInsertPath);
          if (insertIndex !== -1) {
            currentFilePaths.splice(insertIndex + 1, 0, newFilePath);
          } else {
            currentFilePaths.push(newFilePath);
          }
        } else {
          currentFilePaths.push(newFilePath);
        }

        // Save and refresh
        await context.workspaceState.update(LAST_SELECTED_FILES_KEY, currentFilePaths);
        await context.workspaceState.update(FILE_ORDER_KEY, currentFilePaths);

        currentPanel.webview.postMessage({ command: 'requestState' });
        setupFileWatchers();

        vscode.window.showInformationMessage(`Created: ${filename.trim()}`);

      } catch (error) {
        vscode.window.showErrorMessage(`Failed to create file: ${error.message}`);
      }
    }

    async function handleFileSelection(context, entityConfig) {
      const wf = vscode.workspace.workspaceFolders;
      if (!wf?.length) {
        vscode.window.showErrorMessage('No workspace folder open.');
        return;
      }
      const root = path.normalize(wf[0].uri.fsPath);

      console.log('[handleFileSelection] Workspace root:', root);

      // Step 1: Select files or folders
      const uris = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: true,
        canSelectMany: true,
        openLabel: 'Select Files/Folders',
        filters: {
          'Text & Jav Files': ['txt', 'jav'],
          'All Files': ['*']
        }
      });

      if (!uris || uris.length === 0) return;

      // Collect all files from selected items
      let selectedFiles = [];
      for (const uri of uris) {
        const p = path.normalize(uri.fsPath);
        console.log('[handleFileSelection] Processing URI path:', p);

        try {
          if (!fs.existsSync(p)) {
            console.error('[handleFileSelection] Path does not exist:', p);
            continue;
          }

          const stat = fs.statSync(p);

          if (stat.isFile()) {
            console.log('[handleFileSelection] Adding file:', p);
            selectedFiles.push(p);
          } else if (stat.isDirectory()) {
            console.log('[handleFileSelection] Scanning directory:', p);
            const files = await collectFilesFromDirectory(p);
            console.log('[handleFileSelection] Found files in directory:', files.length);
            selectedFiles.push(...files);
          }
        } catch (err) {
          console.error('[handleFileSelection] Error processing path:', p, err.message);
          vscode.window.showErrorMessage(`Error processing ${path.basename(p)}: ${err.message}`);
        }
      }

      console.log('[handleFileSelection] Total files before filter:', selectedFiles.length);

      // Filter to only .txt and .jav files
      selectedFiles = selectedFiles.filter(f => {
        const ext = path.extname(f).toLowerCase();
        const matches = ext === '.txt' || ext === '.jav';
        if (!matches) {
          console.log('[handleFileSelection] Filtered out:', f, 'ext:', ext);
        }
        return matches;
      });

      console.log('[handleFileSelection] Files after extension filter:', selectedFiles.length);

      if (selectedFiles.length === 0) {
        vscode.window.showInformationMessage('No .txt or .jav files found in selection.');
        return;
      }

      // Step 2: Ask if user wants to apply regex filter
      const filterChoice = await vscode.window.showQuickPick(
        ['No filter - use all files', 'Apply regex filter'],
        { placeHolder: `${selectedFiles.length} files found. Apply filter?` }
      );

      if (!filterChoice) return;

      if (filterChoice === 'Apply regex filter') {
        selectedFiles = await applyRegexFilter(context, selectedFiles);
        if (!selectedFiles || selectedFiles.length === 0) return;
      }

      // Save selected files and update
      // Apply saved order if available
      const savedOrder = context.workspaceState.get(FILE_ORDER_KEY, []);
      if (savedOrder.length > 0) {
        const orderedPaths = [];
        const pathSet = new Set(selectedFiles);

        // Add files in saved order first
        for (const p of savedOrder) {
          const normalized = path.normalize(p);
          if (pathSet.has(normalized)) {
            orderedPaths.push(normalized);
            pathSet.delete(normalized);
          }
        }

        // Add new files not in saved order at the end
        orderedPaths.push(...Array.from(pathSet));

        currentFilePaths = orderedPaths;
      } else {
        currentFilePaths = selectedFiles;
      }

      await context.workspaceState.update(LAST_SELECTED_FILES_KEY, currentFilePaths);
      await context.workspaceState.update(FILE_ORDER_KEY, currentFilePaths);
      updateWebview();
      setupFileWatchers(); // Setup watchers for new files
      vscode.window.showInformationMessage(`Loaded ${selectedFiles.length} files into dashboard.`);
    }

    async function applyRegexFilter(context, files) {
      const savedRegexes = context.globalState.get(SAVED_REGEXES_KEY, []);

      // Build quick pick items
      const items = [
        { label: '$(add) Enter new regex pattern', isNew: true },
        ...savedRegexes.map(r => ({ label: r, isSaved: true }))
      ];

      if (savedRegexes.length > 0) {
        items.push({ label: '$(trash) Clear saved patterns', isClear: true });
      }

      const choice = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select or enter regex pattern to filter filenames'
      });

      if (!choice) return null;

      if (choice.isClear) {
        await context.globalState.update(SAVED_REGEXES_KEY, []);
        vscode.window.showInformationMessage('Cleared saved regex patterns');
        return files; // Return unfiltered
      }

      let pattern;
      if (choice.isNew) {
        pattern = await vscode.window.showInputBox({
          prompt: 'Enter regex pattern to match filenames',
          placeHolder: 'e.g., ^ch\\d+\\.jav$ or scene.*\\.txt',
          validateInput: (value) => {
            try {
              new RegExp(value);
              return null;
            } catch (e) {
              return 'Invalid regex pattern';
            }
          }
        });

        if (!pattern) return null;

        // Ask if user wants to save this pattern
        const saveIt = await vscode.window.showQuickPick(
          ['Yes', 'No'],
          { placeHolder: 'Save this regex pattern for future use?' }
        );

        if (saveIt === 'Yes') {
          const updated = [...savedRegexes, pattern];
          await context.globalState.update(SAVED_REGEXES_KEY, updated);
        }
      } else {
        pattern = choice.label;
      }

      // Apply filter
      try {
        const regex = new RegExp(pattern);
        const filtered = files.filter(f => regex.test(path.basename(f)));

        if (filtered.length === 0) {
          vscode.window.showWarningMessage('No files matched the regex pattern.');
          return null;
        }

        vscode.window.showInformationMessage(`Regex matched ${filtered.length} of ${files.length} files.`);
        return filtered;
      } catch (e) {
        vscode.window.showErrorMessage(`Regex error: ${e.message}`);
        return null;
      }
    }

    async function collectFilesFromDirectory(dir) {
      const files = [];

      const walk = (d) => {
        try {
          // Normalize path for Windows
          const normalizedDir = path.normalize(d);

          if (!fs.existsSync(normalizedDir)) {
            console.error('[collectFilesFromDirectory] Directory does not exist:', normalizedDir);
            return;
          }

          const entries = fs.readdirSync(normalizedDir, { withFileTypes: true });

          for (const entry of entries) {
            // Use path.join which handles Windows paths correctly
            const fullPath = path.normalize(path.join(normalizedDir, entry.name));

            try {
              // Re-verify type using fs.statSync for reliability
              const stat = fs.statSync(fullPath);

              if (stat.isFile()) {
                files.push(fullPath);
              } else if (stat.isDirectory()) {
                walk(fullPath);
              }
            } catch (err) {
              console.error('[collectFilesFromDirectory] Error processing:', fullPath, err.message);
              continue;
            }
          }
        } catch (err) {
          console.error('[collectFilesFromDirectory] Error reading directory:', d, err.message);
        }
      };

      walk(dir);
      return files;
    }
  };
}

module.exports = { createDashboardCommand };
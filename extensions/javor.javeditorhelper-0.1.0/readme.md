# Jav Editor Helper

Extension for VSCode. Provides dialog-quote editing, quotation conversion, text cleanup, and automatic capitalization.

## Features

* **Edit Dialog Quotes** (`JavEditorHelper.editDialog`): Wrap, join, or split dialogue lines based on cursor position.
* **Convert to Curly Quotations** (`Jav.convertToCurlyQuotation`): Replace straight quotes with smart curly quotes.
* **Convert to Straight Quotations** (`Jav.convertToStraightQuotation`): Replace curly quotes with straight quotes.
* **Text Cleanup** (`Jav.textCleanup`): Remove trailing spaces, fix spacing around punctuation, normalize dashes and apostrophes, enforce capitalization rules.

## Commands

| Command                   | Description                                                  |
| ------------------------- | ------------------------------------------------------------ |
| `Jav: Edit Dialog Quotes` | Wrap/join/split dialogue quotes                              |
| `Jav: Curly Quotation`    | Convert selected or whole document quotes to curly quotes    |
| `Jav: Straight Quotation` | Convert selected or whole document quotes to straight quotes |
| `Jav: Text Cleanup`       | Trim spaces, fix punctuation spacing, apply capitalization   |

## Configuration

Edit settings in `settings.json`:

```json
{
  "JavEditorHelper.capitalizationFilePath": "/absolute/path/to/list.txt"
}
```

* `capitalizationFilePath`: Path to newline-delimited words/phrases to preserve capitalization.

## Installation

Copy `package.json` and `extension.js` into a VSCode extension folder. Run `vsce package` to build `.vsix`. Install via `Extensions: Install from VSIX...`.




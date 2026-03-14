# Live AutoCorrect

A VS Code extension that automatically corrects words as you type, using a custom definitions file.

## How It Works

You define correction pairs in a plain text file (`word :: replacement`, one per line). When you finish typing a word (by pressing space, punctuation, etc.), the extension checks it against your list and swaps it instantly.

## Features

- **Live correction** — words are replaced the moment you finish typing them
- **Batch correction** — apply corrections to a selection or the current line via command
- **Case preservation** — capitalisation of the original word carries over to the replacement
- **Live preview** — as you type, matching entries from the definitions file appear inline
- **Toggle on/off** — status bar button to enable or disable corrections
- **Hot reload** — edits to the definitions file take effect immediately (no restart needed)

## Setup

1. Install the extension.
2. Create a definitions file. Each line maps a misspelling to the correct form:

```
teh :: the
recieve :: receive
adn :: and
```

3. Point the extension to your file:
   - Open **Settings** → search `liveAutoCorrect.correctionFilePath`
   - Set the full path to your definitions file

If no path is set, the extension looks for `autocorrect.txt` in the extension's own directory.

## Commands

| Command | What it does |
|---|---|
| `Toggle Live AutoCorrect` | Turn live correction on or off |
| `Apply AutoCorrect to Selection or Line` | Run all corrections on the selected text (or the current line if nothing is selected) |

## Settings

| Setting | Type | Default | Description |
|---|---|---|---|
| `liveAutoCorrect.correctionFilePath` | string | `""` | Full path to your definitions file |

## Definitions File Format

Plain text. One entry per line. Separate the trigger word and its replacement with `::`.

```
abbrev :: abbreviation
dont :: don't
```

Matching is case-insensitive. The replacement preserves the case pattern of what you typed (lowercase, capitalised, or ALL CAPS).
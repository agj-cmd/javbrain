# Cursor Scroll

Vim/Helix-like scroll position commands for VS Code. Quickly scroll the cursor line to the center, top, or bottom of the editor window.

## Features

This extension provides three commands inspired by Vim/Helix's `zz`, `zt`, and `zb` commands:

- **Scroll: Center Cursor Line** (`zz`) - Scrolls the current cursor line to the center of the editor window
- **Scroll: Top Cursor Line** (`zt`) - Scrolls the current cursor line to the top of the editor window
- **Scroll: Bottom Cursor Line** (`zb`) - Scrolls the current cursor line to the bottom of the editor window

## Default Keybindings

| Command | Windows/Linux | macOS | Vim/Helix |
|---------|--------------|-------|-----------|
| Center | `Ctrl+L` | `Ctrl+L` | `zz` |
| Top | `Ctrl+Shift+L` | `Ctrl+Shift+L` | `zt` |
| Bottom | `Ctrl+Alt+L` | `Ctrl+Alt+L` | `zb` |

## Usage

1. Place your cursor on any line in the editor
2. Press the keybinding for the desired scroll position
3. The editor will scroll to position your cursor line at the center, top, or bottom

You can also access these commands via the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`):
- Type "Scroll: Center Cursor Line"
- Type "Scroll: Top Cursor Line"
- Type "Scroll: Bottom Cursor Line"

## Customizing Keybindings

You can customize the keybindings by adding the following to your `keybindings.json`:

```json
{
  "key": "your-preferred-key",
  "command": "scroll-position.center",
  "when": "editorTextFocus"
}
```

Replace `scroll-position.center` with `scroll-position.top` or `scroll-position.bottom` for the other commands.

## Why This Extension?

While VS Code has some built-in scrolling commands, there's no simple way to scroll the cursor line to a specific position (center, top, or bottom) with independent keybindings. This extension fills that gap, especially for users coming from Vim or Helix editors.

Unlike the "Center Editor Window" extension which toggles between positions, this extension provides three separate commands that can be bound to individual keys.

## Requirements

- VS Code 1.74.0 or higher

## License

MIT

# HSL Adjust Hex Colors

Batch adjust hue, saturation, lightness, and alpha of all hex colors in a selection.

## Installation

1. Copy folder to `~/.vscode/extensions/hsl-adjust`
2. Restart VS Code

Or for development:
1. Open folder in VS Code
2. Press F5 to run in Extension Development Host

## Usage

1. Select text containing hex colors
2. Run command: `HSL Adjust: Modify Hex Colors`
   - Or use shortcut: `Ctrl+Shift+H` (Windows/Linux) / `Cmd+Shift+H` (Mac)
3. Enter values when prompted:
   - **Hue**: -180 to 180 (degrees)
   - **Saturation**: -100 to 100 (percent)
   - **Lightness**: -100 to 100 (percent)
   - **Alpha**: -100 to 100 (percent shift), or `=50` for absolute value
   - Leave blank for no change
   - Use `-` for negative values

## Alpha Input

- `20` = increase alpha by 20%
- `-30` = decrease alpha by 30%
- `=50` = set alpha to exactly 50%
- blank = no change (preserves existing alpha if present)

## Supported Formats (input)

All converted to `#rrggbb` or `#rrggbbaa` output:

| Format | Example |
|--------|---------|
| #rgb | #f00 |
| #rgba | #f008 |
| #rrggbb | #ff0000 |
| #rrggbbaa | #ff000080 |

## Examples

| Input | H=0, S=0, L=0, A=blank | H=180, S=0, L=0, A=blank |
|-------|------------------------|--------------------------|
| #f00 | #ff0000 | #00ffff |
| #ff08 | #ffff0088 | #0000ff88 |
| #FFFF0060 | #ffff0060 | #0000ff60 |
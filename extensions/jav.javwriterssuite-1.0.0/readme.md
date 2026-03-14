# JavWritersSuite

Syntax highlighting, formatting, and clean view for `.jav` files.

## Syntax

### Headers

Bracket-based headers with 6 nesting levels:

```
HEADER 1 [
    HEADER 2 [
        HEADER 3 [
            content
        ]
    ]
]
```

### Dialog

```
"Regular dialog"
*"Italic dialog"*
```

### Formatting

```
*italic text*
**bold text**
```

### Annotations

```
\note\
\\alt note\\
```

Supports multiline.

### Lists

```
- unordered item
- another item

1. ordered item
2. another item
```

### Cut/Strike

```
line to cut--

Inline <cut text> here.
```

## Commands

| Command | Description |
|---------|-------------|
| `Jav: Format` | Format document with proper indentation and spacing |
| `Jav: Toggle Clean View` | Toggle visual decorations on/off |
| `Jav: Toggle Section Highlights` | Toggle color highlighting for sections |

## Features

### Formatter

- Indents content based on bracket nesting (max 6 levels)
- Adds blank lines between paragraphs
- No blank lines between list items
- Normalizes whitespace

### Clean View

- Collapses configured characters (default: `*`)
- Optional curly quote replacement (`"` → `""`)
- Read time displayed before header brackets

### Section Highlights

Toggle with `Jav: Toggle Section Highlights`. Colors current section background:
- 🟢 Level 1 (green)
- 🟡 Level 2 (yellow)
- 🔴 Level 3 (red)
- 🩷 Level 4 (pink)
- 🟣 Level 5 (purple)
- 🔵 Level 6 (blue)

### Outline

Color-coded header levels in outline view:
- 🟢 Level 1
- 🟡 Level 2
- 🔴 Level 3
- 🩷 Level 4
- 🟣 Level 5
- 🔵 Level 6

### Status Bar

Shows reading progress and total read time.

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `jav.collapseChars` | `["*"]` | Characters to collapse |
| `jav.readTime` | `true` | Show read time on headers |
| `jav.readTimeWpm` | `240` | Words per minute |
| `jav.curlyQuotes` | `false` | Visual curly quote replacement |
| `jav.uppercaseHeaders` | `true` | Auto-uppercase headers |
| `jav.uppercaseDebounce` | `500` | Debounce delay (ms) |

## Scopes for Theming

```jsonc
// settings.json
"editor.tokenColorCustomizations": {
    "textMateRules": [
        { "scope": "header1", "settings": { "foreground": "#..." } },
        { "scope": "header2", "settings": { "foreground": "#..." } },
        { "scope": "header3", "settings": { "foreground": "#..." } },
        { "scope": "header4", "settings": { "foreground": "#..." } },
        { "scope": "header5", "settings": { "foreground": "#..." } },
        { "scope": "header6", "settings": { "foreground": "#..." } },
        { "scope": "dialog", "settings": { "foreground": "#..." } },
        { "scope": "italicDialog", "settings": { "foreground": "#..." } },
        { "scope": "bold", "settings": { "fontStyle": "bold" } },
        { "scope": "italics", "settings": { "fontStyle": "italic" } },
        { "scope": "notes", "settings": { "foreground": "#..." } },
        { "scope": "altNotes", "settings": { "foreground": "#..." } },
        { "scope": "cut", "settings": { "foreground": "#..." } },
        { "scope": "readtime", "settings": { "foreground": "#..." } },
        { "scope": "listItem", "settings": { "foreground": "#..." } },
        { "scope": "numberedList", "settings": { "foreground": "#..." } }
    ]
}
```
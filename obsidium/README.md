# Obsidium

A lightweight local Chrome browser extension for Markdown note-taking with real-time dynamic knowledge graph visualization.

## Features

- **Markdown Editor** - Full CommonMark + GFM support with syntax highlighting
- **Real-time Preview** - Live rendering with scroll sync
- **Wikilinks** - `[[Note Title]]` and `[[Note|Alias]]` syntax for bidirectional linking
- **Tags** - `#tag` and `#nested/tag` support
- **Local Graph** - Real-time visualization of note connections
- **Global Graph** - Full knowledge graph view with search and filtering
- **Local File System** - Open and edit Obsidian vaults directly
- **Pure Black & White Design** - Minimalist aesthetic with dark/light mode

## Installation

### From Source (Developer Mode)

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the `obsidium` folder
5. The extension icon will appear in your toolbar

### Icon Setup

Before loading the extension, you need to create PNG icons:

1. Open `/assets/icons/icon.svg` in an image editor
2. Export as PNG in three sizes:
   - `icon-16.png` (16x16 pixels)
   - `icon-48.png` (48x48 pixels)
   - `icon-128.png` (128x128 pixels)
3. Save all three files in the `/assets/icons/` folder

Alternatively, use any online SVG to PNG converter.

## Usage

### Quick Start

1. Click the Obsidium icon in your Chrome toolbar
2. Click "Open Full App" to open in a new tab, or "Open Side Panel" to use in the sidebar
3. Create your first note by clicking the "+" button
4. Start writing in Markdown!

### Opening an Obsidian Vault

1. Click the folder icon in the toolbar
2. Select your Obsidian vault folder
3. Grant file system access when prompted
4. Your notes will be imported and synced

### Keyboard Shortcuts

- `Ctrl/Cmd + S` - Save note
- `Ctrl/Cmd + N` - New note
- `Ctrl/Cmd + B` - Bold text
- `Ctrl/Cmd + I` - Italic text
- `Ctrl/Cmd + K` - Insert link
- `Ctrl/Cmd + Shift + K` - Insert wikilink
- `Tab` - Indent
- `Shift + Tab` - Unindent

### Wikilinks

Link to other notes using double brackets:
- `[[Note Title]]` - Link to a note
- `[[Note Title|Display Text]]` - Link with custom text
- `![[Note Title]]` - Embed a note (preview only)

### Tags

Add tags anywhere in your notes:
- `#tag` - Simple tag
- `#category/subtag` - Nested tag

## Design Philosophy

Obsidium follows Swiss International / Bauhaus minimalism:
- Pure black and white color palette
- Gray scale for information hierarchy
- No distracting colors
- Typography-focused interface
- Maximum contrast for accessibility (WCAG 2.1 AA)

## Technical Details

- **Manifest Version**: V3
- **Storage**: IndexedDB for notes, chrome.storage for settings
- **File System**: File System Access API for local files
- **No Backend Required**: All data stays on your device

## Browser Support

- Chrome 86+
- Edge 86+
- Other Chromium-based browsers

Firefox and Safari are not supported due to File System Access API limitations.

## Privacy

Obsidium stores all data locally on your device. No data is sent to any server.

## License

MIT License

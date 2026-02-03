/**
 * Obsidium Editor Module
 * Markdown editor with syntax highlighting
 */

let editorElement = null;

/**
 * Initialize the editor
 */
export function initEditor() {
  editorElement = document.getElementById('editor');
  
  if (!editorElement) {
    console.error('Editor element not found');
    return;
  }
  
  // Setup keyboard shortcuts
  setupShortcuts();
  
  // Setup tab handling
  editorElement.addEventListener('keydown', handleTab);
}

/**
 * Get editor content
 */
export function getEditorContent() {
  return editorElement?.value || '';
}

/**
 * Set editor content
 */
export function setEditorContent(content) {
  if (editorElement) {
    editorElement.value = content;
  }
}

/**
 * Setup keyboard shortcuts
 */
function setupShortcuts() {
  editorElement.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + B - Bold
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault();
      wrapSelection('**', '**');
    }
    
    // Ctrl/Cmd + I - Italic
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
      e.preventDefault();
      wrapSelection('*', '*');
    }
    
    // Ctrl/Cmd + K - Link
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      insertLink();
    }
    
    // Ctrl/Cmd + Shift + K - Wikilink
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'K') {
      e.preventDefault();
      wrapSelection('[[', ']]');
    }
    
    // Ctrl/Cmd + ` - Code
    if ((e.ctrlKey || e.metaKey) && e.key === '`') {
      e.preventDefault();
      wrapSelection('`', '`');
    }
    
    // Ctrl/Cmd + Shift + ` - Code block
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === '~') {
      e.preventDefault();
      wrapSelection('```\n', '\n```');
    }
    
    // Ctrl/Cmd + Shift + S - Strikethrough
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
      e.preventDefault();
      wrapSelection('~~', '~~');
    }
  });
}

/**
 * Handle tab key
 */
function handleTab(e) {
  if (e.key === 'Tab') {
    e.preventDefault();
    
    const start = editorElement.selectionStart;
    const end = editorElement.selectionEnd;
    const value = editorElement.value;
    
    if (e.shiftKey) {
      // Unindent
      const beforeCursor = value.substring(0, start);
      const lastNewline = beforeCursor.lastIndexOf('\n');
      const lineStart = lastNewline + 1;
      
      if (value.substring(lineStart, lineStart + 2) === '  ') {
        editorElement.value = value.substring(0, lineStart) + value.substring(lineStart + 2);
        editorElement.selectionStart = editorElement.selectionEnd = start - 2;
      }
    } else {
      // Indent
      editorElement.value = value.substring(0, start) + '  ' + value.substring(end);
      editorElement.selectionStart = editorElement.selectionEnd = start + 2;
    }
    
    // Trigger input event
    editorElement.dispatchEvent(new Event('input'));
  }
}

/**
 * Wrap selected text with prefix and suffix
 */
function wrapSelection(prefix, suffix) {
  const start = editorElement.selectionStart;
  const end = editorElement.selectionEnd;
  const value = editorElement.value;
  const selectedText = value.substring(start, end);
  
  const newText = prefix + selectedText + suffix;
  editorElement.value = value.substring(0, start) + newText + value.substring(end);
  
  // Set cursor position
  if (selectedText) {
    editorElement.selectionStart = start;
    editorElement.selectionEnd = start + newText.length;
  } else {
    editorElement.selectionStart = editorElement.selectionEnd = start + prefix.length;
  }
  
  editorElement.focus();
  editorElement.dispatchEvent(new Event('input'));
}

/**
 * Insert a markdown link
 */
function insertLink() {
  const start = editorElement.selectionStart;
  const end = editorElement.selectionEnd;
  const value = editorElement.value;
  const selectedText = value.substring(start, end);
  
  if (selectedText) {
    // Wrap selection as link text
    const newText = `[${selectedText}](url)`;
    editorElement.value = value.substring(0, start) + newText + value.substring(end);
    editorElement.selectionStart = start + selectedText.length + 3;
    editorElement.selectionEnd = start + newText.length - 1;
  } else {
    // Insert empty link template
    const newText = '[text](url)';
    editorElement.value = value.substring(0, start) + newText + value.substring(end);
    editorElement.selectionStart = start + 1;
    editorElement.selectionEnd = start + 5;
  }
  
  editorElement.focus();
  editorElement.dispatchEvent(new Event('input'));
}

/**
 * Insert text at cursor position
 */
export function insertText(text) {
  const start = editorElement.selectionStart;
  const value = editorElement.value;
  
  editorElement.value = value.substring(0, start) + text + value.substring(start);
  editorElement.selectionStart = editorElement.selectionEnd = start + text.length;
  
  editorElement.focus();
  editorElement.dispatchEvent(new Event('input'));
}

/**
 * Get current line content
 */
export function getCurrentLine() {
  const value = editorElement.value;
  const pos = editorElement.selectionStart;
  
  const lineStart = value.lastIndexOf('\n', pos - 1) + 1;
  const lineEnd = value.indexOf('\n', pos);
  
  return value.substring(lineStart, lineEnd === -1 ? value.length : lineEnd);
}

/**
 * Focus the editor
 */
export function focusEditor() {
  editorElement?.focus();
}

export default {
  initEditor,
  getEditorContent,
  setEditorContent,
  insertText,
  getCurrentLine,
  focusEditor
};

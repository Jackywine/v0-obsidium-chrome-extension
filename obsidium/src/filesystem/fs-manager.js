/**
 * Obsidium File System Manager
 * Handles local folder access using File System Access API
 */

import { db } from '../storage/db.js';
import notesStore from '../storage/notes.js';
import { extractTitle, parseFrontMatter, parseTags, parseLinks } from './markdown-parser.js';

let directoryHandle = null;
let fileHandles = new Map();

/**
 * Initialize file system manager
 */
export function initFileSystem() {
  // Try to restore previous directory handle
  restoreDirectoryHandle();
}

/**
 * Check if File System Access API is available
 */
export function isFileSystemSupported() {
  return 'showDirectoryPicker' in window;
}

/**
 * Open a local folder
 */
export async function openFolder() {
  if (!isFileSystemSupported()) {
    alert('Your browser does not support the File System Access API. Please use Chrome or Edge.');
    return null;
  }
  
  try {
    directoryHandle = await window.showDirectoryPicker({
      mode: 'readwrite'
    });
    
    // Save handle for later restoration
    await saveDirectoryHandle();
    
    // Scan folder and import notes
    await scanFolder();
    
    return directoryHandle;
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error('Failed to open folder:', error);
    }
    return null;
  }
}

/**
 * Save directory handle to IndexedDB
 */
async function saveDirectoryHandle() {
  if (!directoryHandle) return;
  
  try {
    await db.put('workspace', {
      key: 'directoryHandle',
      handle: directoryHandle,
      name: directoryHandle.name,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Failed to save directory handle:', error);
  }
}

/**
 * Restore directory handle from IndexedDB
 */
async function restoreDirectoryHandle() {
  try {
    const saved = await db.get('workspace', 'directoryHandle');
    if (saved?.handle) {
      // Verify permission
      const permission = await saved.handle.queryPermission({ mode: 'readwrite' });
      if (permission === 'granted') {
        directoryHandle = saved.handle;
        await scanFolder();
      }
    }
  } catch (error) {
    console.error('Failed to restore directory handle:', error);
  }
}

/**
 * Scan folder for markdown files
 */
async function scanFolder(handle = directoryHandle, path = '') {
  if (!handle) return;
  
  for await (const entry of handle.values()) {
    const entryPath = path ? `${path}/${entry.name}` : entry.name;
    
    if (entry.kind === 'file' && entry.name.endsWith('.md')) {
      await importMarkdownFile(entry, entryPath);
    } else if (entry.kind === 'directory' && !entry.name.startsWith('.')) {
      // Recurse into subdirectories
      await scanFolder(entry, entryPath);
    }
  }
  
  // Refresh UI
  const { loadNotes } = await import('../main.js');
  await loadNotes();
}

/**
 * Import a markdown file as a note
 */
async function importMarkdownFile(fileHandle, filePath) {
  try {
    const file = await fileHandle.getFile();
    const content = await file.text();
    
    // Check if note already exists
    const existingNotes = await notesStore.getAllNotes();
    const existing = existingNotes.find(n => n.filePath === filePath);
    
    // Extract metadata
    const title = extractTitle(content, fileHandle.name);
    const frontMatter = parseFrontMatter(content);
    const tags = [
      ...parseTags(content),
      ...(frontMatter?.tags || [])
    ];
    const links = parseLinks(content);
    
    if (existing) {
      // Update existing note if content changed
      if (existing.content !== content) {
        await notesStore.updateNote(existing.id, {
          content,
          title,
          tags: [...new Set(tags)],
          links
        });
      }
    } else {
      // Create new note
      await notesStore.createNote({
        title,
        content,
        tags: [...new Set(tags)],
        links,
        filePath,
        fileHandle
      });
    }
    
    // Store file handle for later
    fileHandles.set(filePath, fileHandle);
    
  } catch (error) {
    console.error(`Failed to import ${filePath}:`, error);
  }
}

/**
 * Save note to file
 */
export async function saveNoteToFile(note) {
  if (!note.filePath || !directoryHandle) return false;
  
  try {
    let fileHandle = fileHandles.get(note.filePath);
    
    if (!fileHandle) {
      // Try to get file handle from path
      fileHandle = await getFileHandle(note.filePath);
      if (fileHandle) {
        fileHandles.set(note.filePath, fileHandle);
      }
    }
    
    if (!fileHandle) {
      // Create new file
      fileHandle = await createFile(note.filePath);
      if (fileHandle) {
        fileHandles.set(note.filePath, fileHandle);
      }
    }
    
    if (fileHandle) {
      const writable = await fileHandle.createWritable();
      await writable.write(note.content);
      await writable.close();
      return true;
    }
  } catch (error) {
    console.error('Failed to save note to file:', error);
  }
  
  return false;
}

/**
 * Get file handle from path
 */
async function getFileHandle(filePath) {
  if (!directoryHandle) return null;
  
  const parts = filePath.split('/');
  const fileName = parts.pop();
  
  let currentHandle = directoryHandle;
  
  // Navigate to directory
  for (const part of parts) {
    try {
      currentHandle = await currentHandle.getDirectoryHandle(part);
    } catch {
      return null;
    }
  }
  
  // Get file
  try {
    return await currentHandle.getFileHandle(fileName);
  } catch {
    return null;
  }
}

/**
 * Create a new file
 */
async function createFile(filePath) {
  if (!directoryHandle) return null;
  
  const parts = filePath.split('/');
  const fileName = parts.pop();
  
  let currentHandle = directoryHandle;
  
  // Create directories if needed
  for (const part of parts) {
    try {
      currentHandle = await currentHandle.getDirectoryHandle(part, { create: true });
    } catch (error) {
      console.error('Failed to create directory:', error);
      return null;
    }
  }
  
  // Create file
  try {
    return await currentHandle.getFileHandle(fileName, { create: true });
  } catch (error) {
    console.error('Failed to create file:', error);
    return null;
  }
}

/**
 * Delete a file
 */
export async function deleteFile(filePath) {
  if (!directoryHandle) return false;
  
  const parts = filePath.split('/');
  const fileName = parts.pop();
  
  let currentHandle = directoryHandle;
  
  // Navigate to directory
  for (const part of parts) {
    try {
      currentHandle = await currentHandle.getDirectoryHandle(part);
    } catch {
      return false;
    }
  }
  
  // Delete file
  try {
    await currentHandle.removeEntry(fileName);
    fileHandles.delete(filePath);
    return true;
  } catch (error) {
    console.error('Failed to delete file:', error);
    return false;
  }
}

/**
 * Create a new markdown file
 */
export async function createMarkdownFile(title) {
  if (!directoryHandle) return null;
  
  const fileName = `${sanitizeFileName(title)}.md`;
  
  try {
    const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
    
    // Write initial content
    const writable = await fileHandle.createWritable();
    await writable.write(`# ${title}\n\n`);
    await writable.close();
    
    fileHandles.set(fileName, fileHandle);
    
    // Create note in storage
    const note = await notesStore.createNote({
      title,
      content: `# ${title}\n\n`,
      filePath: fileName,
      fileHandle
    });
    
    return note;
  } catch (error) {
    console.error('Failed to create file:', error);
    return null;
  }
}

/**
 * Rename a file
 */
export async function renameFile(oldPath, newTitle) {
  // File System Access API doesn't support rename directly
  // We need to create new file, copy content, delete old file
  
  const fileHandle = fileHandles.get(oldPath);
  if (!fileHandle) return false;
  
  try {
    const file = await fileHandle.getFile();
    const content = await file.text();
    
    const newFileName = `${sanitizeFileName(newTitle)}.md`;
    const newHandle = await directoryHandle.getFileHandle(newFileName, { create: true });
    
    const writable = await newHandle.createWritable();
    await writable.write(content);
    await writable.close();
    
    // Delete old file
    await deleteFile(oldPath);
    
    // Update handles
    fileHandles.set(newFileName, newHandle);
    
    return newFileName;
  } catch (error) {
    console.error('Failed to rename file:', error);
    return false;
  }
}

/**
 * Sanitize file name
 */
function sanitizeFileName(name) {
  return name
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 200);
}

/**
 * Get current directory name
 */
export function getCurrentDirectoryName() {
  return directoryHandle?.name || null;
}

/**
 * Check if we have an open directory
 */
export function hasOpenDirectory() {
  return directoryHandle !== null;
}

export default {
  initFileSystem,
  isFileSystemSupported,
  openFolder,
  saveNoteToFile,
  deleteFile,
  createMarkdownFile,
  renameFile,
  getCurrentDirectoryName,
  hasOpenDirectory
};

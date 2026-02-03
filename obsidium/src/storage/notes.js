/**
 * Obsidium Notes Storage Module
 * CRUD operations for notes with link parsing
 */

import { db } from './db.js';
import { parseLinks, parseBacklinks, parseTags, parseFrontMatter } from '../filesystem/markdown-parser.js';

/**
 * Generate a unique ID
 */
export function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a new note
 */
export async function createNote(data = {}) {
  const now = Date.now();
  const note = {
    id: data.id || generateId(),
    title: data.title || 'Untitled',
    content: data.content || '',
    tags: data.tags || [],
    aliases: data.aliases || [],
    links: data.links || [],
    backlinks: data.backlinks || [],
    createdAt: data.createdAt || now,
    updatedAt: data.updatedAt || now,
    folderId: data.folderId || null,
    filePath: data.filePath || null,
    fileHandle: data.fileHandle || null
  };

  // Parse content for links and tags
  if (note.content) {
    const parsed = parseNoteContent(note.content);
    note.links = parsed.links;
    note.tags = [...new Set([...note.tags, ...parsed.tags])];
    if (parsed.frontMatter) {
      note.aliases = parsed.frontMatter.aliases || note.aliases;
      note.tags = [...new Set([...note.tags, ...(parsed.frontMatter.tags || [])])];
    }
  }

  await db.put('notes', note);
  
  // Update backlinks in referenced notes
  await updateBacklinks(note.id, note.links);
  
  return note;
}

/**
 * Get a note by ID
 */
export async function getNote(id) {
  return await db.get('notes', id);
}

/**
 * Get all notes
 */
export async function getAllNotes() {
  const notes = await db.getAll('notes');
  // Sort by updatedAt descending
  return notes.sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * Get notes by folder
 */
export async function getNotesByFolder(folderId) {
  return await db.getByIndex('notes', 'folderId', folderId);
}

/**
 * Update a note
 */
export async function updateNote(id, updates) {
  const note = await getNote(id);
  if (!note) {
    throw new Error(`Note not found: ${id}`);
  }

  const oldLinks = note.links || [];
  
  const updatedNote = {
    ...note,
    ...updates,
    updatedAt: Date.now()
  };

  // Re-parse content if it changed
  if (updates.content !== undefined) {
    const parsed = parseNoteContent(updates.content);
    updatedNote.links = parsed.links;
    updatedNote.tags = [...new Set([...(updates.tags || []), ...parsed.tags])];
    if (parsed.frontMatter) {
      updatedNote.aliases = parsed.frontMatter.aliases || updatedNote.aliases;
      updatedNote.tags = [...new Set([...updatedNote.tags, ...(parsed.frontMatter.tags || [])])];
    }
  }

  await db.put('notes', updatedNote);

  // Update backlinks if links changed
  const newLinks = updatedNote.links || [];
  if (JSON.stringify(oldLinks) !== JSON.stringify(newLinks)) {
    await updateBacklinksOnChange(id, oldLinks, newLinks);
  }

  return updatedNote;
}

/**
 * Delete a note
 */
export async function deleteNote(id) {
  const note = await getNote(id);
  if (!note) return;

  // Remove this note from backlinks of other notes
  for (const linkedId of note.links || []) {
    await removeBacklink(linkedId, id);
  }

  // Remove backlinks pointing to this note from other notes
  for (const backlinkId of note.backlinks || []) {
    const otherNote = await getNote(backlinkId);
    if (otherNote) {
      otherNote.links = otherNote.links.filter(l => l !== id);
      await db.put('notes', otherNote);
    }
  }

  await db.delete('notes', id);
}

/**
 * Search notes by title or content
 */
export async function searchNotes(query) {
  if (!query) return [];
  
  const notes = await getAllNotes();
  const lowerQuery = query.toLowerCase();
  
  return notes.filter(note => {
    const titleMatch = note.title.toLowerCase().includes(lowerQuery);
    const contentMatch = note.content.toLowerCase().includes(lowerQuery);
    const tagMatch = note.tags.some(tag => tag.toLowerCase().includes(lowerQuery));
    const aliasMatch = note.aliases.some(alias => alias.toLowerCase().includes(lowerQuery));
    
    return titleMatch || contentMatch || tagMatch || aliasMatch;
  });
}

/**
 * Get note by title (for wikilink resolution)
 */
export async function getNoteByTitle(title) {
  const notes = await getAllNotes();
  const lowerTitle = title.toLowerCase();
  
  return notes.find(note => {
    if (note.title.toLowerCase() === lowerTitle) return true;
    if (note.aliases.some(alias => alias.toLowerCase() === lowerTitle)) return true;
    return false;
  });
}

/**
 * Get notes by tag
 */
export async function getNotesByTag(tag) {
  const notes = await getAllNotes();
  return notes.filter(note => note.tags.includes(tag));
}

/**
 * Get all unique tags
 */
export async function getAllTags() {
  const notes = await getAllNotes();
  const tagSet = new Set();
  
  notes.forEach(note => {
    note.tags.forEach(tag => tagSet.add(tag));
  });
  
  return Array.from(tagSet).sort();
}

/**
 * Parse note content for links and tags
 */
function parseNoteContent(content) {
  const links = parseLinks(content);
  const tags = parseTags(content);
  const frontMatter = parseFrontMatter(content);
  
  return { links, tags, frontMatter };
}

/**
 * Update backlinks for a new note
 */
async function updateBacklinks(noteId, links) {
  for (const linkedTitle of links) {
    const linkedNote = await getNoteByTitle(linkedTitle);
    if (linkedNote && linkedNote.id !== noteId) {
      if (!linkedNote.backlinks.includes(noteId)) {
        linkedNote.backlinks.push(noteId);
        await db.put('notes', linkedNote);
      }
    }
  }
}

/**
 * Update backlinks when links change
 */
async function updateBacklinksOnChange(noteId, oldLinks, newLinks) {
  // Remove backlinks for links that were removed
  for (const oldLink of oldLinks) {
    if (!newLinks.includes(oldLink)) {
      const linkedNote = await getNoteByTitle(oldLink);
      if (linkedNote) {
        linkedNote.backlinks = linkedNote.backlinks.filter(id => id !== noteId);
        await db.put('notes', linkedNote);
      }
    }
  }

  // Add backlinks for new links
  for (const newLink of newLinks) {
    if (!oldLinks.includes(newLink)) {
      const linkedNote = await getNoteByTitle(newLink);
      if (linkedNote && !linkedNote.backlinks.includes(noteId)) {
        linkedNote.backlinks.push(noteId);
        await db.put('notes', linkedNote);
      }
    }
  }
}

/**
 * Remove a backlink from a note
 */
async function removeBacklink(noteId, backlinkId) {
  const note = await getNote(noteId);
  if (note) {
    note.backlinks = note.backlinks.filter(id => id !== backlinkId);
    await db.put('notes', note);
  }
}

/**
 * Get graph data for visualization
 */
export async function getGraphData() {
  const notes = await getAllNotes();
  
  const nodes = notes.map(note => ({
    id: note.id,
    title: note.title,
    linkCount: (note.links?.length || 0) + (note.backlinks?.length || 0),
    tags: note.tags
  }));

  const links = [];
  const noteMap = new Map(notes.map(n => [n.title.toLowerCase(), n]));
  
  for (const note of notes) {
    for (const linkedTitle of note.links || []) {
      const linkedNote = noteMap.get(linkedTitle.toLowerCase()) || 
                         notes.find(n => n.aliases.some(a => a.toLowerCase() === linkedTitle.toLowerCase()));
      if (linkedNote) {
        links.push({
          source: note.id,
          target: linkedNote.id
        });
      }
    }
  }

  return { nodes, links };
}

/**
 * Get local graph data for a specific note
 */
export async function getLocalGraphData(noteId) {
  const note = await getNote(noteId);
  if (!note) return { nodes: [], links: [] };

  const notes = await getAllNotes();
  const noteMap = new Map(notes.map(n => [n.title.toLowerCase(), n]));
  
  // Collect connected notes
  const connectedIds = new Set([noteId]);
  
  // Add notes this note links to
  for (const linkedTitle of note.links || []) {
    const linkedNote = noteMap.get(linkedTitle.toLowerCase()) ||
                       notes.find(n => n.aliases.some(a => a.toLowerCase() === linkedTitle.toLowerCase()));
    if (linkedNote) {
      connectedIds.add(linkedNote.id);
    }
  }
  
  // Add notes that link to this note
  for (const backlinkId of note.backlinks || []) {
    connectedIds.add(backlinkId);
  }

  // Build nodes and links
  const nodes = [];
  const links = [];
  
  for (const id of connectedIds) {
    const n = notes.find(note => note.id === id);
    if (n) {
      nodes.push({
        id: n.id,
        title: n.title,
        linkCount: (n.links?.length || 0) + (n.backlinks?.length || 0),
        isCenter: n.id === noteId,
        tags: n.tags
      });
    }
  }

  // Add links between connected notes
  for (const n of nodes) {
    const sourceNote = notes.find(note => note.id === n.id);
    if (sourceNote) {
      for (const linkedTitle of sourceNote.links || []) {
        const linkedNote = noteMap.get(linkedTitle.toLowerCase()) ||
                           notes.find(note => note.aliases.some(a => a.toLowerCase() === linkedTitle.toLowerCase()));
        if (linkedNote && connectedIds.has(linkedNote.id)) {
          links.push({
            source: n.id,
            target: linkedNote.id
          });
        }
      }
    }
  }

  return { nodes, links };
}

export default {
  createNote,
  getNote,
  getAllNotes,
  getNotesByFolder,
  updateNote,
  deleteNote,
  searchNotes,
  getNoteByTitle,
  getNotesByTag,
  getAllTags,
  getGraphData,
  getLocalGraphData,
  generateId
};

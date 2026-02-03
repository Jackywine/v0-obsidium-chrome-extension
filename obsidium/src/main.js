/**
 * Obsidium Main Entry Point
 * Initializes all modules and handles app state
 */

import { themeManager } from './theme/theme-manager.js';
import { db } from './storage/db.js';
import notesStore from './storage/notes.js';
import { initEditor, getEditorContent, setEditorContent } from './editor/editor.js';
import { renderPreview } from './preview/preview.js';
import { initLocalGraph, updateLocalGraph } from './graph/local-graph.js';
import { initGlobalGraph, updateGlobalGraph } from './graph/global-graph.js';
import { initFileSystem } from './filesystem/fs-manager.js';

// App State
const state = {
  currentNote: null,
  notes: [],
  tags: [],
  sidebarCollapsed: false,
  previewVisible: false,
  localGraphVisible: false,
  autoSaveTimeout: null
};

// DOM Elements
const elements = {};

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
  // Cache DOM elements
  cacheElements();
  
  // Initialize theme
  await themeManager.init();
  
  // Wait for database
  await db.readyPromise;
  
  // Initialize modules
  initEditor();
  initLocalGraph();
  initGlobalGraph();
  initFileSystem();
  
  // Load data
  await loadNotes();
  await loadTags();
  
  // Setup event listeners
  setupEventListeners();
  
  // Show initial state
  updateUI();
});

function cacheElements() {
  elements.sidebar = document.getElementById('sidebar');
  elements.notesList = document.getElementById('notesList');
  elements.tagsList = document.getElementById('tagsList');
  elements.foldersList = document.getElementById('foldersList');
  elements.editor = document.getElementById('editor');
  elements.noteTitle = document.getElementById('noteTitle');
  elements.preview = document.getElementById('preview');
  elements.previewPane = document.getElementById('previewPane');
  elements.editorPane = document.getElementById('editorPane');
  elements.localGraphPanel = document.getElementById('localGraphPanel');
  elements.localGraph = document.getElementById('localGraph');
  elements.globalGraph = document.getElementById('globalGraph');
  elements.globalGraphModal = document.getElementById('globalGraphModal');
  elements.settingsModal = document.getElementById('settingsModal');
  elements.deleteModal = document.getElementById('deleteModal');
  elements.searchInput = document.getElementById('searchInput');
  elements.editorEmptyState = document.getElementById('editorEmptyState');
  elements.editorArea = document.getElementById('editorArea');
}

async function loadNotes() {
  state.notes = await notesStore.getAllNotes();
  renderNotesList();
}

async function loadTags() {
  state.tags = await notesStore.getAllTags();
  renderTagsList();
}

function renderNotesList() {
  const container = elements.notesList;
  const emptyState = document.getElementById('emptyNotes');
  
  if (state.notes.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }
  
  emptyState.classList.add('hidden');
  
  // Clear existing notes (keep empty state)
  const existingItems = container.querySelectorAll('.note-item');
  existingItems.forEach(item => item.remove());
  
  // Render notes
  state.notes.forEach(note => {
    const item = createNoteItem(note);
    container.appendChild(item);
  });
}

function createNoteItem(note) {
  const item = document.createElement('div');
  item.className = 'note-item';
  item.dataset.noteId = note.id;
  
  if (state.currentNote?.id === note.id) {
    item.classList.add('active');
  }
  
  const date = new Date(note.updatedAt);
  const dateStr = date.toLocaleDateString(undefined, { 
    month: 'short', 
    day: 'numeric' 
  });
  
  item.innerHTML = `
    <div class="note-item-content">
      <div class="note-item-title">${escapeHtml(note.title)}</div>
      <div class="note-item-meta">${dateStr}</div>
    </div>
  `;
  
  item.addEventListener('click', () => selectNote(note.id));
  
  return item;
}

function renderTagsList() {
  const container = elements.tagsList;
  const emptyState = document.getElementById('emptyTags');
  
  if (state.tags.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }
  
  emptyState.classList.add('hidden');
  
  // Clear existing tags
  const existingItems = container.querySelectorAll('.tag-item');
  existingItems.forEach(item => item.remove());
  
  // Get tag counts
  const tagCounts = {};
  state.notes.forEach(note => {
    note.tags.forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });
  
  // Render tags
  state.tags.forEach(tag => {
    const item = document.createElement('div');
    item.className = 'tag-item';
    item.innerHTML = `
      <span class="tag-name">${escapeHtml(tag)}</span>
      <span class="tag-count">${tagCounts[tag] || 0}</span>
    `;
    item.addEventListener('click', () => filterByTag(tag));
    container.appendChild(item);
  });
}

async function selectNote(noteId) {
  const note = await notesStore.getNote(noteId);
  if (!note) return;
  
  state.currentNote = note;
  
  // Update UI
  elements.noteTitle.value = note.title;
  setEditorContent(note.content);
  
  // Update preview
  if (state.previewVisible) {
    updatePreview();
  }
  
  // Update local graph
  if (state.localGraphVisible) {
    updateLocalGraph(noteId);
  }
  
  // Update notes list selection
  document.querySelectorAll('.note-item').forEach(item => {
    item.classList.toggle('active', item.dataset.noteId === noteId);
  });
  
  // Show editor, hide empty state
  elements.editorEmptyState.classList.add('hidden');
  elements.editor.parentElement.style.display = '';
}

async function createNewNote() {
  const note = await notesStore.createNote({
    title: 'Untitled',
    content: ''
  });
  
  await loadNotes();
  await selectNote(note.id);
  
  // Focus title input
  elements.noteTitle.focus();
  elements.noteTitle.select();
}

async function deleteCurrentNote() {
  if (!state.currentNote) return;
  
  await notesStore.deleteNote(state.currentNote.id);
  state.currentNote = null;
  
  // Reload notes
  await loadNotes();
  await loadTags();
  
  // Show empty state
  elements.editorEmptyState.classList.remove('hidden');
  elements.noteTitle.value = '';
  setEditorContent('');
  
  // Close modal
  elements.deleteModal.classList.add('hidden');
}

async function saveCurrentNote() {
  if (!state.currentNote) return;
  
  const content = getEditorContent();
  const title = elements.noteTitle.value || 'Untitled';
  
  await notesStore.updateNote(state.currentNote.id, {
    title,
    content
  });
  
  state.currentNote.title = title;
  state.currentNote.content = content;
  
  // Update notes list
  renderNotesList();
  
  // Update preview
  if (state.previewVisible) {
    updatePreview();
  }
  
  // Update local graph
  if (state.localGraphVisible) {
    updateLocalGraph(state.currentNote.id);
  }
}

function autoSave() {
  if (state.autoSaveTimeout) {
    clearTimeout(state.autoSaveTimeout);
  }
  
  state.autoSaveTimeout = setTimeout(() => {
    saveCurrentNote();
  }, 1000);
}

function updatePreview() {
  if (!state.currentNote) return;
  
  const content = getEditorContent();
  const noteMap = new Map(state.notes.map(n => [n.title.toLowerCase(), n]));
  
  const html = renderPreview(content, noteMap, state.currentNote.id);
  elements.preview.innerHTML = html;
  
  // Setup wikilink clicks
  elements.preview.querySelectorAll('.wikilink').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const noteId = link.dataset.noteId;
      if (noteId) {
        selectNote(noteId);
      }
    });
  });
}

function togglePreview() {
  state.previewVisible = !state.previewVisible;
  
  if (state.previewVisible) {
    elements.previewPane.classList.remove('hidden');
    updatePreview();
  } else {
    elements.previewPane.classList.add('hidden');
  }
}

function toggleLocalGraph() {
  state.localGraphVisible = !state.localGraphVisible;
  
  if (state.localGraphVisible) {
    elements.localGraphPanel.classList.remove('hidden');
    if (state.currentNote) {
      updateLocalGraph(state.currentNote.id);
    }
  } else {
    elements.localGraphPanel.classList.add('hidden');
  }
}

function toggleGlobalGraph() {
  const isVisible = !elements.globalGraphModal.classList.contains('hidden');
  
  if (isVisible) {
    elements.globalGraphModal.classList.add('hidden');
  } else {
    elements.globalGraphModal.classList.remove('hidden');
    updateGlobalGraph();
  }
}

function toggleSidebar() {
  state.sidebarCollapsed = !state.sidebarCollapsed;
  elements.sidebar.classList.toggle('collapsed', state.sidebarCollapsed);
}

function filterByTag(tag) {
  // Filter notes list by tag
  document.querySelectorAll('.note-item').forEach(item => {
    const noteId = item.dataset.noteId;
    const note = state.notes.find(n => n.id === noteId);
    
    if (note && note.tags.includes(tag)) {
      item.style.display = '';
    } else {
      item.style.display = 'none';
    }
  });
}

function searchNotes(query) {
  if (!query) {
    document.querySelectorAll('.note-item').forEach(item => {
      item.style.display = '';
    });
    return;
  }
  
  const lowerQuery = query.toLowerCase();
  
  document.querySelectorAll('.note-item').forEach(item => {
    const noteId = item.dataset.noteId;
    const note = state.notes.find(n => n.id === noteId);
    
    if (!note) return;
    
    const titleMatch = note.title.toLowerCase().includes(lowerQuery);
    const contentMatch = note.content.toLowerCase().includes(lowerQuery);
    
    item.style.display = titleMatch || contentMatch ? '' : 'none';
  });
}

function updateUI() {
  // Show empty state if no current note
  if (!state.currentNote) {
    elements.editorEmptyState.classList.remove('hidden');
  }
}

function setupEventListeners() {
  // Sidebar toggle
  document.getElementById('toggleSidebar').addEventListener('click', toggleSidebar);
  
  // New note buttons
  document.getElementById('newNote').addEventListener('click', createNewNote);
  document.getElementById('createFirstNote')?.addEventListener('click', createNewNote);
  document.getElementById('emptyNewNote').addEventListener('click', createNewNote);
  
  // Editor events
  elements.editor.addEventListener('input', autoSave);
  elements.noteTitle.addEventListener('input', autoSave);
  
  // Preview toggle
  document.getElementById('togglePreview').addEventListener('click', togglePreview);
  
  // Local graph toggle
  document.getElementById('toggleLocalGraph').addEventListener('click', toggleLocalGraph);
  document.getElementById('closeLocalGraph').addEventListener('click', toggleLocalGraph);
  
  // Global graph
  document.getElementById('toggleGlobalGraph').addEventListener('click', toggleGlobalGraph);
  document.getElementById('closeGlobalGraph').addEventListener('click', toggleGlobalGraph);
  document.getElementById('globalGraphBackdrop').addEventListener('click', toggleGlobalGraph);
  
  // Delete note
  document.getElementById('deleteNote').addEventListener('click', () => {
    if (!state.currentNote) return;
    document.getElementById('deleteNoteName').textContent = state.currentNote.title;
    elements.deleteModal.classList.remove('hidden');
  });
  document.getElementById('confirmDelete').addEventListener('click', deleteCurrentNote);
  document.getElementById('cancelDelete').addEventListener('click', () => {
    elements.deleteModal.classList.add('hidden');
  });
  document.getElementById('deleteBackdrop').addEventListener('click', () => {
    elements.deleteModal.classList.add('hidden');
  });
  
  // Settings
  document.getElementById('openSettings').addEventListener('click', () => {
    elements.settingsModal.classList.remove('hidden');
  });
  document.getElementById('closeSettings').addEventListener('click', () => {
    elements.settingsModal.classList.add('hidden');
  });
  document.getElementById('settingsBackdrop').addEventListener('click', () => {
    elements.settingsModal.classList.add('hidden');
  });
  
  // Theme toggle
  document.getElementById('themeToggle').addEventListener('click', () => {
    themeManager.toggle();
  });
  
  // Theme select
  document.getElementById('themeSelect').addEventListener('change', (e) => {
    themeManager.setTheme(e.target.value);
  });
  
  // Search
  elements.searchInput.addEventListener('input', (e) => {
    searchNotes(e.target.value);
  });
  
  // Sidebar tabs
  document.querySelectorAll('.sidebar-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      
      // Update active tab
      document.querySelectorAll('.sidebar-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tabName);
      });
      
      // Show corresponding content
      document.querySelectorAll('[data-tab-content]').forEach(content => {
        content.classList.toggle('hidden', content.dataset.tabContent !== tabName);
      });
    });
  });
  
  // Font size setting
  document.getElementById('fontSize').addEventListener('input', (e) => {
    const value = e.target.value;
    document.getElementById('fontSizeValue').textContent = value;
    document.documentElement.style.setProperty('--font-size-base', `${value}px`);
  });
  
  // Line height setting
  document.getElementById('lineHeight').addEventListener('input', (e) => {
    const value = e.target.value;
    document.getElementById('lineHeightValue').textContent = value;
    document.documentElement.style.setProperty('--line-height', value);
  });
  
  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + S to save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveCurrentNote();
    }
    
    // Ctrl/Cmd + N for new note
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      createNewNote();
    }
    
    // Escape to close modals
    if (e.key === 'Escape') {
      elements.globalGraphModal.classList.add('hidden');
      elements.settingsModal.classList.add('hidden');
      elements.deleteModal.classList.add('hidden');
    }
  });
  
  // Open folder
  document.getElementById('openFolder').addEventListener('click', async () => {
    const { openFolder } = await import('./filesystem/fs-manager.js');
    await openFolder();
  });
  
  // Export data
  document.getElementById('exportData').addEventListener('click', async () => {
    const notes = await notesStore.getAllNotes();
    const data = JSON.stringify(notes, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `obsidium-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
  });
}

// Utility functions
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Export for other modules
export { state, loadNotes, loadTags, selectNote };

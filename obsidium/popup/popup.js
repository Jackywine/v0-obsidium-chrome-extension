/**
 * Obsidium Popup Script
 * Note: 'chrome' is a global API provided by the browser, no import needed
 */

import { themeManager } from '../src/theme/theme-manager.js';
import { db } from '../src/storage/db.js';
import notesStore from '../src/storage/notes.js';

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize theme
  await themeManager.init();

  // Load stats
  await loadStats();

  // Setup event listeners
  setupEventListeners();
});

async function loadStats() {
  try {
    await db.readyPromise;
    
    const notes = await notesStore.getAllNotes();
    const tags = await notesStore.getAllTags();
    
    // Count total links
    let linkCount = 0;
    notes.forEach(note => {
      linkCount += (note.links?.length || 0);
    });

    document.getElementById('noteCount').textContent = notes.length;
    document.getElementById('linkCount').textContent = linkCount;
    document.getElementById('tagCount').textContent = tags.length;
  } catch (e) {
    console.error('Failed to load stats:', e);
  }
}

function setupEventListeners() {
  // Theme toggle
  document.getElementById('themeToggle').addEventListener('click', () => {
    themeManager.toggle();
  });

  // Save quick note
  document.getElementById('saveQuickNote').addEventListener('click', async () => {
    const textarea = document.getElementById('quickNote');
    const content = textarea.value.trim();
    
    if (!content) return;

    try {
      await notesStore.createNote({
        title: `Quick Note - ${new Date().toLocaleString()}`,
        content: content
      });
      
      textarea.value = '';
      await loadStats();
      
      // Show feedback
      const btn = document.getElementById('saveQuickNote');
      const originalText = btn.innerHTML;
      btn.innerHTML = '<svg class="icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg> Saved!';
      setTimeout(() => {
        btn.innerHTML = originalText;
      }, 1500);
    } catch (e) {
      console.error('Failed to save note:', e);
    }
  });

  // Open full app
  document.getElementById('openApp').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('pages/main.html') });
    window.close();
  });

  // Open side panel
  document.getElementById('openSidePanel').addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.sidePanel.open({ windowId: tab.windowId });
      window.close();
    } catch (e) {
      console.error('Failed to open side panel:', e);
      // Fallback to opening in new tab
      chrome.tabs.create({ url: chrome.runtime.getURL('pages/main.html') });
      window.close();
    }
  });

  // Quick note keyboard shortcut
  document.getElementById('quickNote').addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      document.getElementById('saveQuickNote').click();
    }
  });
}

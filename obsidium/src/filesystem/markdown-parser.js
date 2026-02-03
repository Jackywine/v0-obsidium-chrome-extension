/**
 * Obsidium Markdown Parser
 * Parses wikilinks, tags, and front matter
 */

/**
 * Parse [[wikilinks]] from content
 * Supports [[Note Title]] and [[Note Title|Display Text]]
 */
export function parseLinks(content) {
  const links = [];
  const regex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
  let match;
  
  while ((match = regex.exec(content)) !== null) {
    const linkTitle = match[1].trim();
    if (linkTitle && !links.includes(linkTitle)) {
      links.push(linkTitle);
    }
  }
  
  return links;
}

/**
 * Parse #tags from content
 * Supports #tag and #nested/tag
 */
export function parseTags(content) {
  const tags = [];
  // Match #tag but not inside code blocks or URLs
  const regex = /(?:^|\s)#([a-zA-Z0-9_/-]+)/g;
  let match;
  
  // Remove code blocks first
  const contentWithoutCode = content
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '');
  
  while ((match = regex.exec(contentWithoutCode)) !== null) {
    const tag = match[1].trim();
    if (tag && !tags.includes(tag)) {
      tags.push(tag);
    }
  }
  
  return tags;
}

/**
 * Parse YAML front matter
 */
export function parseFrontMatter(content) {
  const frontMatterRegex = /^---\n([\s\S]*?)\n---/;
  const match = content.match(frontMatterRegex);
  
  if (!match) return null;
  
  const yaml = match[1];
  const frontMatter = {};
  
  // Simple YAML parsing for common fields
  const lines = yaml.split('\n');
  let currentKey = null;
  let currentArray = null;
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // Check for array item
    if (trimmed.startsWith('- ') && currentKey) {
      const value = trimmed.slice(2).trim();
      if (!currentArray) {
        currentArray = [];
        frontMatter[currentKey] = currentArray;
      }
      currentArray.push(value.replace(/^["']|["']$/g, ''));
      continue;
    }
    
    // Check for key-value pair
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex > 0) {
      currentKey = trimmed.slice(0, colonIndex).trim();
      const value = trimmed.slice(colonIndex + 1).trim();
      currentArray = null;
      
      if (value) {
        // Handle inline arrays [item1, item2]
        if (value.startsWith('[') && value.endsWith(']')) {
          const items = value.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
          frontMatter[currentKey] = items;
        } else {
          frontMatter[currentKey] = value.replace(/^["']|["']$/g, '');
        }
      }
    }
  }
  
  return frontMatter;
}

/**
 * Get content without front matter
 */
export function getContentWithoutFrontMatter(content) {
  return content.replace(/^---\n[\s\S]*?\n---\n?/, '');
}

/**
 * Extract title from content (first H1 or first line)
 */
export function extractTitle(content, filename) {
  // Check front matter for title
  const frontMatter = parseFrontMatter(content);
  if (frontMatter?.title) {
    return frontMatter.title;
  }
  
  // Check for first H1
  const h1Match = content.match(/^#\s+(.+)$/m);
  if (h1Match) {
    return h1Match[1].trim();
  }
  
  // Use filename without extension
  if (filename) {
    return filename.replace(/\.md$/i, '');
  }
  
  // Use first non-empty line
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('---')) {
      return trimmed.slice(0, 100);
    }
  }
  
  return 'Untitled';
}

/**
 * Replace wikilinks with rendered HTML
 */
export function renderWikilinks(content, noteMap, currentNoteId) {
  return content.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (match, linkTitle, displayText) => {
    const title = linkTitle.trim();
    const display = displayText?.trim() || title;
    const linkedNote = noteMap.get(title.toLowerCase());
    
    if (linkedNote) {
      return `<a href="#" class="wikilink" data-note-id="${linkedNote.id}">${display}</a>`;
    } else {
      return `<a href="#" class="wikilink wikilink-missing" data-note-title="${title}">${display}</a>`;
    }
  });
}

/**
 * Render #tags as clickable elements
 */
export function renderTags(content) {
  return content.replace(/(?:^|\s)(#[a-zA-Z0-9_/-]+)/g, (match, tag) => {
    const prefix = match.startsWith(' ') ? ' ' : '';
    return `${prefix}<a href="#" class="tag-link" data-tag="${tag.slice(1)}">${tag}</a>`;
  });
}

/**
 * Check if content has embed syntax ![[note]]
 */
export function parseEmbeds(content) {
  const embeds = [];
  const regex = /!\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
  let match;
  
  while ((match = regex.exec(content)) !== null) {
    const embedTitle = match[1].trim();
    if (embedTitle && !embeds.includes(embedTitle)) {
      embeds.push(embedTitle);
    }
  }
  
  return embeds;
}

/**
 * Calculate backlinks for a note
 */
export function parseBacklinks(noteId, allNotes) {
  const backlinks = [];
  
  for (const note of allNotes) {
    if (note.id === noteId) continue;
    
    const links = parseLinks(note.content);
    if (links.some(link => link.toLowerCase() === noteId.toLowerCase())) {
      backlinks.push(note.id);
    }
  }
  
  return backlinks;
}

export default {
  parseLinks,
  parseTags,
  parseFrontMatter,
  getContentWithoutFrontMatter,
  extractTitle,
  renderWikilinks,
  renderTags,
  parseEmbeds,
  parseBacklinks
};

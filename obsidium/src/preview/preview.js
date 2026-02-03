/**
 * Obsidium Preview Module
 * Renders Markdown to HTML
 */

import { renderWikilinks, renderTags, parseFrontMatter, getContentWithoutFrontMatter } from '../filesystem/markdown-parser.js';

/**
 * Render markdown content to HTML
 */
export function renderPreview(content, noteMap, currentNoteId) {
  if (!content) return '';
  
  // Parse front matter
  const frontMatter = parseFrontMatter(content);
  let mainContent = getContentWithoutFrontMatter(content);
  
  // Process wikilinks first
  mainContent = renderWikilinks(mainContent, noteMap, currentNoteId);
  
  // Process tags
  mainContent = renderTags(mainContent);
  
  // Convert markdown to HTML
  let html = markdownToHtml(mainContent);
  
  // Add front matter display if present
  if (frontMatter) {
    const frontMatterHtml = renderFrontMatter(frontMatter);
    html = frontMatterHtml + html;
  }
  
  return html;
}

/**
 * Simple markdown to HTML converter
 */
function markdownToHtml(markdown) {
  let html = markdown;
  
  // Escape HTML but preserve our custom elements
  html = escapeHtmlExceptCustom(html);
  
  // Headers
  html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
  html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
  html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');
  
  // Code blocks
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
    return `<pre><code class="language-${lang || 'text'}">${code.trim()}</code></pre>`;
  });
  
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');
  
  // Strikethrough
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');
  
  // Horizontal rule
  html = html.replace(/^(?:---|\*\*\*|___)$/gm, '<hr>');
  
  // Blockquotes
  html = html.replace(/^>\s+(.+)$/gm, '<blockquote><p>$1</p></blockquote>');
  // Merge consecutive blockquotes
  html = html.replace(/<\/blockquote>\n<blockquote>/g, '\n');
  
  // Task lists
  html = html.replace(/^-\s+\[x\]\s+(.+)$/gim, '<div class="task-list-item checked"><input type="checkbox" checked disabled><span>$1</span></div>');
  html = html.replace(/^-\s+\[\s?\]\s+(.+)$/gim, '<div class="task-list-item"><input type="checkbox" disabled><span>$1</span></div>');
  
  // Unordered lists
  html = html.replace(/^-\s+(.+)$/gm, '<li>$1</li>');
  html = html.replace(/^\*\s+(.+)$/gm, '<li>$1</li>');
  
  // Ordered lists
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');
  
  // Wrap consecutive li elements in ul/ol
  html = html.replace(/(<li>[\s\S]*?<\/li>\n?)+/g, (match) => {
    return `<ul>${match}</ul>`;
  });
  
  // Links (but not wikilinks which are already processed)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  
  // Images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
  
  // Tables
  html = processTable(html);
  
  // Paragraphs
  html = html.split('\n\n').map(block => {
    block = block.trim();
    if (!block) return '';
    if (block.startsWith('<')) return block;
    return `<p>${block.replace(/\n/g, '<br>')}</p>`;
  }).join('\n');
  
  return html;
}

/**
 * Process markdown tables
 */
function processTable(html) {
  const tableRegex = /^\|(.+)\|\n\|[-:\s|]+\|\n((?:\|.+\|\n?)+)/gm;
  
  return html.replace(tableRegex, (match, headerRow, bodyRows) => {
    // Parse header
    const headers = headerRow.split('|').map(h => h.trim()).filter(Boolean);
    const headerHtml = headers.map(h => `<th>${h}</th>`).join('');
    
    // Parse body rows
    const rows = bodyRows.trim().split('\n');
    const bodyHtml = rows.map(row => {
      const cells = row.split('|').map(c => c.trim()).filter(Boolean);
      const cellsHtml = cells.map(c => `<td>${c}</td>`).join('');
      return `<tr>${cellsHtml}</tr>`;
    }).join('');
    
    return `<table><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>`;
  });
}

/**
 * Escape HTML except our custom elements
 */
function escapeHtmlExceptCustom(text) {
  // Save custom elements
  const customElements = [];
  let index = 0;
  
  // Save wikilinks
  text = text.replace(/<a[^>]*class="wikilink[^"]*"[^>]*>[^<]*<\/a>/g, (match) => {
    customElements.push(match);
    return `__CUSTOM_${index++}__`;
  });
  
  // Save tag links
  text = text.replace(/<a[^>]*class="tag-link"[^>]*>[^<]*<\/a>/g, (match) => {
    customElements.push(match);
    return `__CUSTOM_${index++}__`;
  });
  
  // Escape remaining HTML
  text = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  // Restore custom elements
  customElements.forEach((elem, i) => {
    text = text.replace(`__CUSTOM_${i}__`, elem);
  });
  
  return text;
}

/**
 * Render front matter as a nice display
 */
function renderFrontMatter(frontMatter) {
  const items = [];
  
  if (frontMatter.tags && frontMatter.tags.length) {
    const tags = frontMatter.tags.map(t => 
      `<span class="badge">#${escapeHtml(t)}</span>`
    ).join(' ');
    items.push(`<div class="frontmatter-tags">${tags}</div>`);
  }
  
  if (frontMatter.aliases && frontMatter.aliases.length) {
    items.push(`<div class="frontmatter-aliases"><strong>Aliases:</strong> ${frontMatter.aliases.map(escapeHtml).join(', ')}</div>`);
  }
  
  if (items.length === 0) return '';
  
  return `<div class="frontmatter-display">${items.join('\n')}</div>`;
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export default {
  renderPreview
};

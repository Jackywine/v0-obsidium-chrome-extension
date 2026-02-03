/**
 * Obsidium Global Graph Module
 * Displays the entire knowledge graph using D3.js force simulation
 */

import notesStore from '../storage/notes.js';

let svg = null;
let container = null;
let tooltip = null;
let width = 0;
let height = 0;
let nodes = [];
let links = [];
let nodeElements = [];
let linkElements = [];
let lockedNodes = new Set();
let showOrphans = true;
let searchQuery = '';
let zoom = 1;
let panX = 0;
let panY = 0;

/**
 * Initialize global graph
 */
export function initGlobalGraph() {
  container = document.getElementById('globalGraph');
  if (!container) return;
  
  // Create SVG
  svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  container.appendChild(svg);
  
  // Create main group for zoom/pan
  const mainGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  mainGroup.setAttribute('class', 'main-group');
  svg.appendChild(mainGroup);
  
  // Create tooltip
  tooltip = document.createElement('div');
  tooltip.className = 'graph-tooltip';
  container.appendChild(tooltip);
  
  // Handle resize
  const resizeObserver = new ResizeObserver(() => {
    updateDimensions();
  });
  resizeObserver.observe(container);
  
  // Setup controls
  setupControls();
  setupZoomPan();
  
  updateDimensions();
}

function updateDimensions() {
  const rect = container.getBoundingClientRect();
  width = rect.width || 800;
  height = rect.height || 600;
}

function setupControls() {
  // Show orphans checkbox
  const showOrphansCheckbox = document.getElementById('showOrphans');
  if (showOrphansCheckbox) {
    showOrphansCheckbox.addEventListener('change', (e) => {
      showOrphans = e.target.checked;
      updateGlobalGraph();
    });
  }
  
  // Search input
  const searchInput = document.getElementById('graphSearch');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.toLowerCase();
      highlightSearchResults();
    });
  }
}

function setupZoomPan() {
  let isPanning = false;
  let startX, startY;
  
  // Mouse wheel zoom
  svg.addEventListener('wheel', (e) => {
    e.preventDefault();
    
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    zoom = Math.max(0.1, Math.min(5, zoom * delta));
    
    updateTransform();
  });
  
  // Pan
  svg.addEventListener('mousedown', (e) => {
    if (e.target === svg || e.target.classList.contains('main-group')) {
      isPanning = true;
      startX = e.clientX - panX;
      startY = e.clientY - panY;
      svg.style.cursor = 'grabbing';
    }
  });
  
  document.addEventListener('mousemove', (e) => {
    if (!isPanning) return;
    
    panX = e.clientX - startX;
    panY = e.clientY - startY;
    updateTransform();
  });
  
  document.addEventListener('mouseup', () => {
    isPanning = false;
    svg.style.cursor = '';
  });
}

function updateTransform() {
  const mainGroup = svg.querySelector('.main-group');
  if (mainGroup) {
    const centerX = width / 2;
    const centerY = height / 2;
    mainGroup.setAttribute('transform', 
      `translate(${centerX + panX}, ${centerY + panY}) scale(${zoom}) translate(${-centerX}, ${-centerY})`
    );
  }
}

/**
 * Update global graph
 */
export async function updateGlobalGraph() {
  if (!container || !svg) return;
  
  // Get graph data
  const data = await notesStore.getGraphData();
  
  // Filter orphans if needed
  let filteredNodes = data.nodes;
  let filteredLinks = data.links;
  
  if (!showOrphans) {
    const connectedIds = new Set();
    data.links.forEach(l => {
      connectedIds.add(l.source);
      connectedIds.add(l.target);
    });
    filteredNodes = data.nodes.filter(n => connectedIds.has(n.id));
    filteredLinks = data.links;
  }
  
  if (!filteredNodes.length) {
    renderEmptyState();
    return;
  }
  
  // Update nodes and links
  nodes = filteredNodes.map(n => ({
    ...n,
    x: n.x || width / 2 + (Math.random() - 0.5) * 300,
    y: n.y || height / 2 + (Math.random() - 0.5) * 300,
    locked: lockedNodes.has(n.id)
  }));
  
  links = filteredLinks.map(l => ({
    source: typeof l.source === 'string' ? l.source : l.source.id,
    target: typeof l.target === 'string' ? l.target : l.target.id
  }));
  
  renderGraph();
  startSimulation();
  
  if (searchQuery) {
    highlightSearchResults();
  }
}

function renderEmptyState() {
  const mainGroup = svg.querySelector('.main-group');
  if (mainGroup) mainGroup.innerHTML = '';
  
  const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  text.setAttribute('x', '50%');
  text.setAttribute('y', '50%');
  text.setAttribute('text-anchor', 'middle');
  text.setAttribute('fill', 'currentColor');
  text.setAttribute('opacity', '0.5');
  text.textContent = 'No notes yet. Create your first note!';
  
  const mainGroupNew = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  mainGroupNew.setAttribute('class', 'main-group');
  mainGroupNew.appendChild(text);
  
  svg.innerHTML = '';
  svg.appendChild(mainGroupNew);
}

function renderGraph() {
  const mainGroup = svg.querySelector('.main-group');
  mainGroup.innerHTML = '';
  
  // Create groups
  const linksGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  linksGroup.setAttribute('class', 'links');
  mainGroup.appendChild(linksGroup);
  
  const nodesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  nodesGroup.setAttribute('class', 'nodes');
  mainGroup.appendChild(nodesGroup);
  
  // Render links
  linkElements = links.map(link => {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('class', 'graph-link');
    line.dataset.source = link.source;
    line.dataset.target = link.target;
    linksGroup.appendChild(line);
    return line;
  });
  
  // Render nodes
  nodeElements = nodes.map(node => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const isOrphan = node.linkCount === 0;
    g.setAttribute('class', `graph-node ${isOrphan ? 'orphan' : ''} ${node.locked ? 'locked' : ''}`);
    g.dataset.nodeId = node.id;
    
    // Node circle
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    const radius = Math.min(6 + node.linkCount * 1.5, 25);
    circle.setAttribute('r', radius);
    g.appendChild(circle);
    
    // Node label
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('dy', radius + 12);
    text.textContent = truncateText(node.title, 12);
    g.appendChild(text);
    
    // Event handlers
    g.addEventListener('mouseenter', () => showTooltip(node));
    g.addEventListener('mouseleave', hideTooltip);
    g.addEventListener('click', () => handleNodeClick(node));
    g.addEventListener('dblclick', () => handleNodeDoubleClick(node));
    
    // Drag handlers
    setupDrag(g, node);
    
    nodesGroup.appendChild(g);
    return { element: g, data: node };
  });
  
  updateTransform();
}

function startSimulation() {
  const alpha = 0.5;
  const alphaDecay = 0.01;
  let currentAlpha = alpha;
  
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  
  function tick() {
    if (currentAlpha < 0.001) return;
    
    currentAlpha *= (1 - alphaDecay);
    
    // Apply forces
    applyForces(nodeMap, currentAlpha);
    
    // Update positions
    updatePositions();
    
    requestAnimationFrame(tick);
  }
  
  tick();
}

function applyForces(nodeMap, alpha) {
  const centerX = width / 2;
  const centerY = height / 2;
  
  // Center force
  nodes.forEach(node => {
    if (node.locked) return;
    
    node.vx = (node.vx || 0) * 0.8;
    node.vy = (node.vy || 0) * 0.8;
    
    // Pull toward center
    node.vx += (centerX - node.x) * 0.005 * alpha;
    node.vy += (centerY - node.y) * 0.005 * alpha;
  });
  
  // Link force
  links.forEach(link => {
    const source = nodeMap.get(link.source);
    const target = nodeMap.get(link.target);
    
    if (!source || !target) return;
    
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const distance = Math.sqrt(dx * dx + dy * dy) || 1;
    const targetDistance = 100;
    
    const force = (distance - targetDistance) * 0.03 * alpha;
    const fx = (dx / distance) * force;
    const fy = (dy / distance) * force;
    
    if (!source.locked) {
      source.vx += fx;
      source.vy += fy;
    }
    if (!target.locked) {
      target.vx -= fx;
      target.vy -= fy;
    }
  });
  
  // Repulsion force (optimized with spatial partitioning for large graphs)
  const repulsionStrength = nodes.length > 100 ? 0.3 : 0.5;
  
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distanceSq = dx * dx + dy * dy;
      
      if (distanceSq < 22500) { // 150^2
        const distance = Math.sqrt(distanceSq) || 1;
        const force = (150 - distance) * repulsionStrength * alpha / distance;
        const fx = dx * force;
        const fy = dy * force;
        
        if (!a.locked) {
          a.vx -= fx;
          a.vy -= fy;
        }
        if (!b.locked) {
          b.vx += fx;
          b.vy += fy;
        }
      }
    }
  }
  
  // Apply velocity
  nodes.forEach(node => {
    if (node.locked) return;
    
    node.x += node.vx || 0;
    node.y += node.vy || 0;
  });
}

function updatePositions() {
  nodeElements.forEach(({ element, data }) => {
    const node = nodes.find(n => n.id === data.id);
    if (node) {
      element.setAttribute('transform', `translate(${node.x}, ${node.y})`);
    }
  });
  
  linkElements.forEach((line, i) => {
    const link = links[i];
    const source = nodes.find(n => n.id === link.source);
    const target = nodes.find(n => n.id === link.target);
    
    if (source && target) {
      line.setAttribute('x1', source.x);
      line.setAttribute('y1', source.y);
      line.setAttribute('x2', target.x);
      line.setAttribute('y2', target.y);
    }
  });
}

function setupDrag(element, node) {
  let dragging = false;
  let startX, startY;
  
  element.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    
    element.style.cursor = 'grabbing';
    
    const onMove = (e) => {
      if (!dragging) return;
      
      const dx = (e.clientX - startX) / zoom;
      const dy = (e.clientY - startY) / zoom;
      
      node.x += dx;
      node.y += dy;
      node.locked = true;
      lockedNodes.add(node.id);
      
      element.classList.add('locked');
      
      startX = e.clientX;
      startY = e.clientY;
      
      updatePositions();
    };
    
    const onUp = () => {
      dragging = false;
      element.style.cursor = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

function highlightSearchResults() {
  if (!searchQuery) {
    // Clear highlights
    nodeElements.forEach(({ element }) => {
      element.classList.remove('highlighted', 'dimmed');
    });
    linkElements.forEach(line => {
      line.classList.remove('highlighted', 'dimmed');
    });
    return;
  }
  
  const matchingIds = new Set();
  nodes.forEach(node => {
    if (node.title.toLowerCase().includes(searchQuery)) {
      matchingIds.add(node.id);
    }
  });
  
  nodeElements.forEach(({ element, data }) => {
    if (matchingIds.has(data.id)) {
      element.classList.add('highlighted');
      element.classList.remove('dimmed');
    } else {
      element.classList.remove('highlighted');
      element.classList.add('dimmed');
    }
  });
  
  linkElements.forEach((line, i) => {
    const link = links[i];
    if (matchingIds.has(link.source) || matchingIds.has(link.target)) {
      line.classList.add('highlighted');
      line.classList.remove('dimmed');
    } else {
      line.classList.remove('highlighted');
      line.classList.add('dimmed');
    }
  });
  
  // Center on first match
  if (matchingIds.size > 0) {
    const firstMatch = nodes.find(n => matchingIds.has(n.id));
    if (firstMatch) {
      panX = width / 2 - firstMatch.x;
      panY = height / 2 - firstMatch.y;
      updateTransform();
    }
  }
}

function showTooltip(node) {
  tooltip.innerHTML = `
    <div class="graph-tooltip-title">${escapeHtml(node.title)}</div>
    <div class="graph-tooltip-meta">${node.linkCount} connections</div>
    ${node.tags?.length ? `
      <div class="graph-tooltip-tags">
        ${node.tags.map(t => `<span class="graph-tooltip-tag">#${escapeHtml(t)}</span>`).join('')}
      </div>
    ` : ''}
  `;
  tooltip.classList.add('visible');
  
  const rect = container.getBoundingClientRect();
  const nodeX = (node.x - width / 2) * zoom + width / 2 + panX;
  const nodeY = (node.y - height / 2) * zoom + height / 2 + panY;
  
  tooltip.style.left = `${nodeX + 20}px`;
  tooltip.style.top = `${nodeY - 10}px`;
}

function hideTooltip() {
  tooltip.classList.remove('visible');
}

function handleNodeClick(node) {
  // Navigate to note and close modal
  import('../main.js').then(({ selectNote }) => {
    selectNote(node.id);
    document.getElementById('globalGraphModal').classList.add('hidden');
  });
}

function handleNodeDoubleClick(node) {
  node.locked = false;
  lockedNodes.delete(node.id);
  
  const nodeEl = nodeElements.find(n => n.data.id === node.id);
  if (nodeEl) {
    nodeEl.element.classList.remove('locked');
  }
}

function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 1) + '...';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export default {
  initGlobalGraph,
  updateGlobalGraph
};

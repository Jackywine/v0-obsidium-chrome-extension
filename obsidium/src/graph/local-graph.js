/**
 * Obsidium Local Graph Module
 * Displays connections for the current note using D3.js force simulation
 */

import notesStore from '../storage/notes.js';

let svg = null;
let simulation = null;
let container = null;
let tooltip = null;
let currentNoteId = null;
let width = 0;
let height = 0;
let nodes = [];
let links = [];
let nodeElements = null;
let linkElements = null;
let lockedNodes = new Set();

/**
 * Initialize local graph
 */
export function initLocalGraph() {
  container = document.getElementById('localGraph');
  if (!container) return;
  
  // Create SVG
  svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  container.appendChild(svg);
  
  // Create tooltip
  tooltip = document.createElement('div');
  tooltip.className = 'graph-tooltip';
  container.appendChild(tooltip);
  
  // Handle resize
  const resizeObserver = new ResizeObserver(() => {
    updateDimensions();
    if (simulation) {
      simulation.force('center', createCenterForce());
      simulation.alpha(0.3).restart();
    }
  });
  resizeObserver.observe(container);
  
  updateDimensions();
}

function updateDimensions() {
  const rect = container.getBoundingClientRect();
  width = rect.width || 400;
  height = rect.height || 200;
}

function createCenterForce() {
  return {
    x: width / 2,
    y: height / 2
  };
}

/**
 * Update local graph for a note
 */
export async function updateLocalGraph(noteId) {
  if (!container || !svg) return;
  
  currentNoteId = noteId;
  
  // Get local graph data
  const data = await notesStore.getLocalGraphData(noteId);
  
  if (!data.nodes.length) {
    renderEmptyState();
    return;
  }
  
  // Update nodes and links
  nodes = data.nodes.map(n => ({
    ...n,
    x: n.x || width / 2 + (Math.random() - 0.5) * 100,
    y: n.y || height / 2 + (Math.random() - 0.5) * 100,
    locked: lockedNodes.has(n.id)
  }));
  
  links = data.links.map(l => ({
    source: typeof l.source === 'string' ? l.source : l.source.id,
    target: typeof l.target === 'string' ? l.target : l.target.id
  }));
  
  renderGraph();
  startSimulation();
}

function renderEmptyState() {
  svg.innerHTML = '';
  
  const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  text.setAttribute('x', '50%');
  text.setAttribute('y', '50%');
  text.setAttribute('text-anchor', 'middle');
  text.setAttribute('fill', 'currentColor');
  text.setAttribute('opacity', '0.5');
  text.textContent = 'No connections';
  svg.appendChild(text);
}

function renderGraph() {
  svg.innerHTML = '';
  
  // Create groups
  const linksGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  linksGroup.setAttribute('class', 'links');
  svg.appendChild(linksGroup);
  
  const nodesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  nodesGroup.setAttribute('class', 'nodes');
  svg.appendChild(nodesGroup);
  
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
    g.setAttribute('class', `graph-node ${node.isCenter ? 'center' : ''} ${node.locked ? 'locked' : ''}`);
    g.dataset.nodeId = node.id;
    
    // Node circle
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    const radius = Math.min(8 + node.linkCount * 2, 20);
    circle.setAttribute('r', radius);
    g.appendChild(circle);
    
    // Node label
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('dy', radius + 14);
    text.textContent = truncateText(node.title, 15);
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
}

function startSimulation() {
  // Simple force simulation
  const alpha = 0.3;
  const alphaDecay = 0.02;
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
  
  simulation = { restart: () => { currentAlpha = alpha; tick(); } };
  tick();
}

function applyForces(nodeMap, alpha) {
  const centerX = width / 2;
  const centerY = height / 2;
  
  // Center force
  nodes.forEach(node => {
    if (node.locked) return;
    
    node.vx = (node.vx || 0) * 0.9;
    node.vy = (node.vy || 0) * 0.9;
    
    // Pull toward center
    node.vx += (centerX - node.x) * 0.01 * alpha;
    node.vy += (centerY - node.y) * 0.01 * alpha;
  });
  
  // Link force
  links.forEach(link => {
    const source = nodeMap.get(link.source);
    const target = nodeMap.get(link.target);
    
    if (!source || !target) return;
    
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const distance = Math.sqrt(dx * dx + dy * dy) || 1;
    const targetDistance = 80;
    
    const force = (distance - targetDistance) * 0.05 * alpha;
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
  
  // Repulsion force
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distance = Math.sqrt(dx * dx + dy * dy) || 1;
      
      if (distance < 100) {
        const force = (100 - distance) * 0.1 * alpha;
        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;
        
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
    
    // Boundary constraints
    const padding = 30;
    node.x = Math.max(padding, Math.min(width - padding, node.x));
    node.y = Math.max(padding, Math.min(height - padding, node.y));
  });
}

function updatePositions() {
  // Update node positions
  nodeElements.forEach(({ element, data }) => {
    const node = nodes.find(n => n.id === data.id);
    if (node) {
      element.setAttribute('transform', `translate(${node.x}, ${node.y})`);
    }
  });
  
  // Update link positions
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
    
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    
    element.style.cursor = 'grabbing';
    
    const onMove = (e) => {
      if (!dragging) return;
      
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      
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
  
  // Position tooltip
  const nodeEl = nodeElements.find(n => n.data.id === node.id);
  if (nodeEl) {
    const rect = container.getBoundingClientRect();
    tooltip.style.left = `${node.x + 20}px`;
    tooltip.style.top = `${node.y - 10}px`;
  }
}

function hideTooltip() {
  tooltip.classList.remove('visible');
}

function handleNodeClick(node) {
  if (node.id !== currentNoteId) {
    // Navigate to note
    import('../main.js').then(({ selectNote }) => {
      selectNote(node.id);
    });
  }
}

function handleNodeDoubleClick(node) {
  // Unlock node
  node.locked = false;
  lockedNodes.delete(node.id);
  
  const nodeEl = nodeElements.find(n => n.data.id === node.id);
  if (nodeEl) {
    nodeEl.element.classList.remove('locked');
  }
  
  if (simulation) {
    simulation.restart();
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
  initLocalGraph,
  updateLocalGraph
};

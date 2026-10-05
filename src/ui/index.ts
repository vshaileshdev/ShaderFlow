import type { Graph } from '../core/types';
import { nodeDefinitions } from '../nodes/index';
import { topologicalSort } from '../core/validation';

export type AppState = {
  graph: Graph;
  glsl: string;
  status: 'ready' | 'planning' | 'applying' | 'compiled' | 'compiling' | 'error' | 'last known good';
};

export class UIManager {
  private graphWorkspace = document.getElementById('graph-workspace')!;
  private graphView = document.getElementById('graph-state-view')!;
  private glslView = document.getElementById('glsl-view')!;
  private historyView = document.getElementById('history')!;
  private cmdInput = document.getElementById('cmd-input') as HTMLInputElement;
  private statusIndicator = document.getElementById('status-indicator')!;
  private nodeCount = document.getElementById('stat-nodes')!;
  private edgeCount = document.getElementById('stat-edges')!;
  private btnFit = document.getElementById('btn-fit')!;
  private btnClear = document.getElementById('btn-clear')!;

  private onCommandCb: (cmd: string) => void = () => {};
  private onActionCb: (action: string) => void = () => {};

  constructor() {
    this.cmdInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const text = this.cmdInput.value;
        if (text.trim()) {
          this.onCommandCb(text);
          this.cmdInput.value = '';
        }
      }
    });

    this.btnFit.addEventListener('click', () => {
      // Re-trigger layout/fit
      this.onActionCb('fit');
    });

    this.btnClear.addEventListener('click', () => {
      this.onActionCb('clear');
    });

    const resizeObserver = new ResizeObserver(() => {
      // Re-trigger layout fit without full command loop
      this.onActionCb('fit');
    });
    resizeObserver.observe(this.graphWorkspace);
  }

  public onCommand(cb: (cmd: string) => void) {
    this.onCommandCb = cb;
  }
  
  public onAction(cb: (action: string) => void) {
    this.onActionCb = cb;
  }

  public updateState(state: AppState) {
    this.renderVisualGraph(state.graph);
    this.glslView.textContent = state.glsl;

    this.nodeCount.textContent = Object.keys(state.graph.nodes).length.toString();
    this.edgeCount.textContent = state.graph.connections.length.toString();

    this.statusIndicator.className = '';
    this.statusIndicator.classList.add(state.status.replace(/ /g, '-'));
    this.statusIndicator.textContent = state.status.toUpperCase();
  }

  private renderVisualGraph(graph: Graph) {
    this.graphView.innerHTML = '';
    
    // We keep graphView scale=1 and transform origin centered for calculation ease
    this.graphView.style.transform = 'none'; 
    
    const svgLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgLayer.style.position = 'absolute';
    svgLayer.style.top = '0';
    svgLayer.style.left = '0';
    svgLayer.style.width = '100%';
    svgLayer.style.height = '100%';
    svgLayer.style.pointerEvents = 'none';
    svgLayer.style.overflow = 'visible';
    svgLayer.style.zIndex = '0';
    
    this.graphView.appendChild(svgLayer);

    const positions = this.calculateLayout(graph);
    const portElements: Record<string, HTMLElement> = {};
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    Object.keys(graph.nodes).forEach(nodeId => {
      const node = graph.nodes[nodeId];
      const def = nodeDefinitions[node.type];
      const pos = positions[nodeId] || { x: 0, y: 0 };
      
      const card = document.createElement('div');
      card.className = `node-card type-${def.type}`;
      card.style.left = `${pos.x}px`;
      card.style.top = `${pos.y}px`;
      
      const humanId = nodeId.replace('_', ' ');
      let displayType = def.type.charAt(0).toUpperCase() + def.type.slice(1);
      if (def.type === 'uv') displayType = 'UV';
      
      let html = `<div class="title"><span>${displayType}</span> <span class="id">${humanId}</span></div>`;
      
      def.inputs.forEach(port => {
        html += `<div class="node-port input"><div class="port-dot" id="port-${nodeId}-${port.id}"></div> <span class="port-label">${port.name} <span class="port-type">${port.type}</span></span></div>`;
      });
      
      def.outputs.forEach(port => {
        html += `<div class="node-port output"><span class="port-label"><span class="port-type">${port.type}</span> ${port.name}</span> <div class="port-dot" id="port-${nodeId}-${port.id}"></div></div>`;
      });

      const params = Object.entries(node.parameters);
      if (params.length > 0) {
        html += `<div class="node-params">`;
        params.forEach(([key, val]) => {
          const formattedKey = key.charAt(0).toUpperCase() + key.slice(1);
          const formattedVal = typeof val === 'number' && Number.isInteger(val) ? val.toFixed(1) : val;
          html += `<div>${formattedKey}: ${formattedVal}</div>`;
        });
        html += `</div>`;
      }

      card.innerHTML = html;
      this.graphView.appendChild(card);
      
      def.inputs.forEach(port => {
        portElements[`${nodeId}-${port.id}`] = card.querySelector(`#port-${nodeId}-${port.id}`) as HTMLElement;
      });
      def.outputs.forEach(port => {
        portElements[`${nodeId}-${port.id}`] = card.querySelector(`#port-${nodeId}-${port.id}`) as HTMLElement;
      });
    });

    // Draw connections and compute bounding box
    requestAnimationFrame(() => {
      // Find bounding box for auto-fit
      const cards = this.graphView.querySelectorAll('.node-card');
      if (cards.length > 0) {
        cards.forEach(c => {
          const el = c as HTMLElement;
          const x = el.offsetLeft;
          const y = el.offsetTop;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x + el.offsetWidth > maxX) maxX = x + el.offsetWidth;
          if (y + el.offsetHeight > maxY) maxY = y + el.offsetHeight;
        });
      } else {
        minX = 0; minY = 0; maxX = 100; maxY = 100;
      }

      graph.connections.forEach(conn => {
        const srcEl = portElements[`${conn.sourceNode}-${conn.sourcePort}`];
        const tgtEl = portElements[`${conn.targetNode}-${conn.targetPort}`];
        if (!srcEl || !tgtEl) return;

        // Coordinates strictly relative to graphView (offsetParent)
        let x1 = srcEl.offsetLeft + srcEl.offsetWidth / 2;
        let y1 = srcEl.offsetTop + srcEl.offsetHeight / 2;
        let p1 = srcEl.offsetParent as HTMLElement;
        while(p1 && p1 !== this.graphView) {
          x1 += p1.offsetLeft; y1 += p1.offsetTop;
          p1 = p1.offsetParent as HTMLElement;
        }

        let x2 = tgtEl.offsetLeft + tgtEl.offsetWidth / 2;
        let y2 = tgtEl.offsetTop + tgtEl.offsetHeight / 2;
        let p2 = tgtEl.offsetParent as HTMLElement;
        while(p2 && p2 !== this.graphView) {
          x2 += p2.offsetLeft; y2 += p2.offsetTop;
          p2 = p2.offsetParent as HTMLElement;
        }

        const dx = Math.abs(x2 - x1) * 0.5;
        const pathData = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', pathData);
        path.setAttribute('stroke', '#38bdf8');
        path.setAttribute('stroke-width', '3');
        path.setAttribute('fill', 'none');
        path.setAttribute('marker-end', 'url(#arrowhead)');
        
        svgLayer.appendChild(path);
      });

      // Inject arrowhead definition
      const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      defs.innerHTML = `<marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#38bdf8" /></marker>`;
      svgLayer.appendChild(defs);

      // Auto-fit logic
      const padding = 60;
      const gWidth = (maxX - minX) + padding * 2;
      const gHeight = (maxY - minY) + padding * 2;
      const wsWidth = this.graphWorkspace.clientWidth;
      const wsHeight = this.graphWorkspace.clientHeight;
      
      if (gWidth > 0 && gHeight > 0) {
        const scale = Math.min(1.0, wsWidth / gWidth, wsHeight / gHeight);
        const offsetX = (wsWidth - gWidth * scale) / 2 - (minX * scale) + (padding * scale);
        const offsetY = (wsHeight - gHeight * scale) / 2 - (minY * scale) + (padding * scale);
        
        this.graphView.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
      }
    });
  }

  public calculateLayout(graph: Graph): Record<string, {x: number, y: number}> {
    let sorted: string[] = [];
    try {
      sorted = topologicalSort(graph);
    } catch {
      sorted = Object.keys(graph.nodes).sort();
    }

    const depths: Record<string, number> = {};
    for (const n in graph.nodes) depths[n] = 0;

    for (const node of sorted) {
      const incoming = graph.connections.filter(c => c.targetNode === node);
      for (const conn of incoming) {
        depths[node] = Math.max(depths[node] || 0, (depths[conn.sourceNode] || 0) + 1);
      }
    }

    const byDepth: Record<number, string[]> = {};
    for (const [node, depth] of Object.entries(depths)) {
      if (!byDepth[depth]) byDepth[depth] = [];
      byDepth[depth].push(node);
    }

    const positions: Record<string, {x: number, y: number}> = {};
    const colWidth = 320;
    const rowHeight = 160;

    const typeOrder = ['uv', 'time', 'position', 'noise', 'sine', 'displacement', 'math', 'color'];

    Object.keys(byDepth).forEach(depthStr => {
      const depth = parseInt(depthStr);
      const nodesInCol = byDepth[depth];
      
      nodesInCol.sort((a, b) => {
        const typeA = graph.nodes[a]?.type || '';
        const typeB = graph.nodes[b]?.type || '';
        const indexA = typeOrder.indexOf(typeA);
        const indexB = typeOrder.indexOf(typeB);
        if (indexA !== -1 && indexB !== -1 && indexA !== indexB) {
          return indexA - indexB;
        }
        return a.localeCompare(b);
      });
      
      nodesInCol.forEach((node, i) => {
        positions[node] = {
          x: depth * colWidth,
          y: i * rowHeight
        };
      });
    });

    return positions;
  }

  public addIntentHistory(originalText: string, understood: string[], appliedMsg: string, success: boolean) {
    const li = document.createElement('li');
    
    const cmdSpan = document.createElement('div');
    cmdSpan.className = 'cmd-text';
    cmdSpan.textContent = `🎙️ "${originalText}"`;
    li.appendChild(cmdSpan);
    
    const interpretedDiv = document.createElement('div');
    interpretedDiv.className = 'cmd-interpreted';
    interpretedDiv.style.marginTop = '8px';
    interpretedDiv.style.color = 'var(--text-secondary)';
    interpretedDiv.innerHTML = `<strong>INTERPRETED:</strong><br/>` + understood.map(u => `• ${u}`).join('<br/>');
    li.appendChild(interpretedDiv);

    const appliedDiv = document.createElement('div');
    appliedDiv.className = `cmd-res ${success ? 'success' : 'error'}`;
    appliedDiv.style.marginTop = '8px';
    appliedDiv.innerHTML = `<strong>APPLIED:</strong><br/>↳ ${appliedMsg}`;
    li.appendChild(appliedDiv);
    
    this.historyView.appendChild(li);
    setTimeout(() => {
      const drawer = this.historyView.parentElement;
      if (drawer) drawer.scrollTop = drawer.scrollHeight;
    }, 10);
  }
}

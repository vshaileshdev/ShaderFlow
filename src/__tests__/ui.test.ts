import { describe, it, expect } from 'vitest';
import { UIManager } from '../ui/index';
import type { Graph } from '../core/types';

// Simple DOM Mock for Vitest Node environment
const mockElement = {
  innerHTML: '',
  textContent: '',
  className: '',
  clientWidth: 1000,
  clientHeight: 800,
  style: {},
  classList: { add: () => {} },
  appendChild: () => {},
  addEventListener: () => {},
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
  querySelectorAll: () => [],
  parentElement: { scrollTop: 0, scrollHeight: 100 }
} as any;

(globalThis as any).document = {
  getElementById: () => {
    return mockElement;
  },
  createElement: () => mockElement,
  createElementNS: () => mockElement
} as any;

(globalThis as any).ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('UI Manager - Graph Layout', () => {
  it('deterministically calculates node positions based on topology', () => {
    const ui = new UIManager();
    
    const graph: Graph = {
      nodes: {
        'n_uv': { id: 'n_uv', type: 'UV', parameters: {} },
        'n_noise': { id: 'n_noise', type: 'noise', parameters: {} },
        'n_math': { id: 'n_math', type: 'math', parameters: {} }
      },
      connections: [
        { sourceNode: 'n_uv', sourcePort: 'out', targetNode: 'n_noise', targetPort: 'uv' },
        { sourceNode: 'n_noise', sourcePort: 'out', targetNode: 'n_math', targetPort: 'a' }
      ]
    };
    
    const positions = ui.calculateLayout(graph);
    
    // UV is depth 0, noise is depth 1, math is depth 2
    expect(positions['n_uv'].x).toBeLessThan(positions['n_noise'].x);
    expect(positions['n_noise'].x).toBeLessThan(positions['n_math'].x);
    
    // Should align to grid rows logically
    expect(positions['n_uv'].y).toBe(0);
    expect(positions['n_noise'].y).toBe(0);
    expect(positions['n_math'].y).toBe(0);
  });

  it('places independent nodes in the same column stacked vertically', () => {
    const ui = new UIManager();
    
    const graph: Graph = {
      nodes: {
        'node_a': { id: 'node_a', type: 'math', parameters: {} },
        'node_b': { id: 'node_b', type: 'math', parameters: {} }
      },
      connections: []
    };
    
    const positions = ui.calculateLayout(graph);
    
    // Both depth 0
    expect(positions['node_a'].x).toBe(positions['node_b'].x);
    
    // Y position should increment for the second one (sorted alphabetically)
    expect(positions['node_a'].y).toBeLessThan(positions['node_b'].y);
  });
});

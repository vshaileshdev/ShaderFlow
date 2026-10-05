import { describe, it, expect } from 'vitest';
import type { Graph } from '../core/types';
import { addNode, removeNode, addConnection } from '../core/mutation';
import { topologicalSort } from '../core/validation';
import { compileGraph } from '../core/compiler';

describe('ShaderFlow Engine', () => {
  const emptyGraph: Graph = { nodes: {}, connections: [] };

  describe('Graph & Node Mutations', () => {
    it('creates a graph and adds a node', () => {
      const res = addNode(emptyGraph, { id: 'n1', type: 'time', parameters: {} });
      expect(res.valid).toBe(true);
      expect(res.graph.nodes['n1']).toBeDefined();
    });

    it('supports all required Phase 1 node types', () => {
      const types = ['position', 'uv', 'time', 'noise', 'sine', 'math', 'displacement', 'color'];
      let g = emptyGraph;
      types.forEach((type, index) => {
        const res = addNode(g, { id: `node_${index}`, type, parameters: {} });
        expect(res.valid).toBe(true);
        g = res.graph;
      });
      expect(Object.keys(g.nodes).length).toBe(types.length);
    });

    it('removes a node and its connections', () => {
      let g = addNode(emptyGraph, { id: 'n1', type: 'time', parameters: {} }).graph;
      g = addNode(g, { id: 'n2', type: 'math', parameters: { operation: 'add' } }).graph;
      g = addConnection(g, { sourceNode: 'n1', sourcePort: 'out', targetNode: 'n2', targetPort: 'a' }).graph;
      
      const res = removeNode(g, 'n1');
      expect(res.valid).toBe(true);
      expect(res.graph.nodes['n1']).toBeUndefined();
      expect(res.graph.connections.length).toBe(0);
    });
  });

  describe('Connections & Validation', () => {
    it('allows valid connections', () => {
      let g = addNode(emptyGraph, { id: 'n1', type: 'time', parameters: {} }).graph;
      g = addNode(g, { id: 'n2', type: 'math', parameters: {} }).graph;
      
      const res = addConnection(g, { sourceNode: 'n1', sourcePort: 'out', targetNode: 'n2', targetPort: 'a' });
      expect(res.valid).toBe(true);
      expect(res.graph.connections.length).toBe(1);
    });

    it('rejects invalid connections (type mismatch)', () => {
      let g = addNode(emptyGraph, { id: 'n1', type: 'uv', parameters: {} }).graph; // out: vec2
      g = addNode(g, { id: 'n2', type: 'math', parameters: {} }).graph; // in: float
      
      const res = addConnection(g, { sourceNode: 'n1', sourcePort: 'out', targetNode: 'n2', targetPort: 'a' });
      expect(res.valid).toBe(false);
      expect(res.errors[0].code).toBe('INCOMPATIBLE_TYPE');
    });

    it('rejects invalid connections (missing node/port)', () => {
      let g = addNode(emptyGraph, { id: 'n1', type: 'time', parameters: {} }).graph;
      const res = addConnection(g, { sourceNode: 'n1', sourcePort: 'out', targetNode: 'n2', targetPort: 'a' });
      expect(res.valid).toBe(false);
      expect(res.errors[0].code).toBe('MISSING_NODE');
    });

    it('detects cycles', () => {
      let g = addNode(emptyGraph, { id: 'n1', type: 'math', parameters: {} }).graph;
      g = addNode(g, { id: 'n2', type: 'math', parameters: {} }).graph;
      
      g = addConnection(g, { sourceNode: 'n1', sourcePort: 'out', targetNode: 'n2', targetPort: 'a' }).graph;
      const res = addConnection(g, { sourceNode: 'n2', sourcePort: 'out', targetNode: 'n1', targetPort: 'b' });
      
      expect(res.valid).toBe(false);
      expect(res.errors.some(e => e.code === 'CYCLE_DETECTED')).toBe(true);
    });
  });

  describe('Topological Sorting & Determinism', () => {
    it('produces a deterministic topological ordering', () => {
      let g = emptyGraph;
      g = addNode(g, { id: 'n1', type: 'time', parameters: {} }).graph;
      g = addNode(g, { id: 'n2', type: 'noise', parameters: {} }).graph;
      g = addNode(g, { id: 'n3', type: 'math', parameters: {} }).graph;
      
      g = addConnection(g, { sourceNode: 'n1', sourcePort: 'out', targetNode: 'n3', targetPort: 'a' }).graph;
      g = addConnection(g, { sourceNode: 'n2', sourcePort: 'out', targetNode: 'n3', targetPort: 'b' }).graph;

      const order = topologicalSort(g);
      // n3 must be last since it depends on n1 and n2
      expect(order[2]).toBe('n3');
      // n1 and n2 could be in any order but it must be deterministic (sorted alphabetically when independent)
      expect(order[0]).toBe('n1'); 
      expect(order[1]).toBe('n2'); 
    });
  });

  describe('Compilation & Fallback', () => {
    it('compiles a valid graph to GLSL deterministically', () => {
      let g = emptyGraph;
      g = addNode(g, { id: 'n1', type: 'time', parameters: {} }).graph;
      g = addNode(g, { id: 'n2', type: 'math', parameters: { operation: 'add' } }).graph;
      g = addConnection(g, { sourceNode: 'n1', sourcePort: 'out', targetNode: 'n2', targetPort: 'a' }).graph;
      
      const res = compileGraph(g);
      expect(res.isFallback).toBe(false);
      expect(res.glsl).toContain('float n1_out = u_time;');
      expect(res.glsl).toContain('float n2_out = (n1_out + 0.0);');
    });

    it('falls back to the last known good shader if the graph is invalid', () => {
      // Create a valid graph first
      let g = emptyGraph;
      g = addNode(g, { id: 'n1', type: 'color', parameters: { r: 1, g: 0, b: 0, a: 1 } }).graph;
      const res1 = compileGraph(g);
      expect(res1.isFallback).toBe(false);
      
      // Introduce an invalid state artificially (e.g. bypassing mutation guards to simulate corrupted state)
      const invalidGraph: Graph = {
        nodes: { ...g.nodes },
        connections: [{ sourceNode: 'n1', sourcePort: 'out', targetNode: 'n2', targetPort: 'fake' }]
      };
      
      const res2 = compileGraph(invalidGraph);
      expect(res2.isFallback).toBe(true);
      // Should preserve the GLSL of res1
      expect(res2.glsl).toEqual(res1.glsl);
    });
  });
});

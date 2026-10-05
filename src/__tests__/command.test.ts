import { describe, it, expect } from 'vitest';
import type { Graph } from '../core/types';
import { parseIntent } from '../intent/planner';

describe('Intent Planner', () => {
  const emptyGraph: Graph = { nodes: {}, connections: [] };

  it('parses node creation', () => {
    const parsed = parseIntent('create noise node', emptyGraph);
    expect(parsed.mutations[0]).toEqual({ type: 'ADD_NODE', nodeType: 'noise' });
  });

  it('parses connection', () => {
    const parsed = parseIntent('connect uv to noise', emptyGraph);
    expect(parsed.mutations[0]).toEqual({ type: 'ADD_CONNECTION', sourceNodeType: 'uv', targetNodeType: 'noise' });
  });

  it('parses parameter change (number)', () => {
    const parsed = parseIntent('increase noise 1 scale to 6', emptyGraph);
    expect(parsed.mutations[0]).toEqual({ type: 'SET_PARAMETER', nodeType: 'noise_1', paramName: 'scale', value: 6 });
  });

  it('parses parameter change (string)', () => {
    const parsed = parseIntent('change math 1 operation to multiply', emptyGraph);
    expect(parsed.mutations[0]).toEqual({ type: 'SET_PARAMETER', nodeType: 'math_1', paramName: 'operation', value: 'multiply' });
  });

  it('parses flowing blue cloud to aurora recipe', () => {
    const parsed = parseIntent('make a flowing blue cloud', emptyGraph);
    expect(parsed.recipe).toBe('AURORA');
    expect(parsed.mutations.length).toBeGreaterThan(5); // builds uv, time, noise, sine, math, color
  });
  
  it('parses more detailed semantic mapping', () => {
    const parsed = parseIntent('make it more detailed', emptyGraph);
    expect(parsed.mutations[0]).toEqual({ type: 'SET_PARAMETER', nodeType: 'noise', paramName: 'scale', value: 4.0 });
  });
  
  it('parses slower motion semantic mapping', () => {
    const parsed = parseIntent('make it move slower', emptyGraph);
    expect(parsed.mutations[0]).toEqual({ type: 'SET_PARAMETER', nodeType: 'sine', paramName: 'frequency', value: 0.1 });
  });
  
  it('parses warm colors semantic mapping', () => {
    const parsed = parseIntent('make the colors warmer', emptyGraph);
    expect(parsed.mutations.some(m => m.paramName === 'r' && m.value === 0.8)).toBe(true);
  });
});

import type { Graph } from '../core/types';
import type { IntentResult, IntentMutation } from './types';

export function getSemanticMutations(t: string, _graph: Graph): IntentResult {
  const understood: string[] = [];
  const mutations: IntentMutation[] = [];
  
  // 1. Detail / Frequency Mapping
  if (t.includes('more detailed') || t.includes('more detail') || t.includes('finer')) {
    understood.push('Increase spatial detail (noise scale)');
    mutations.push({ type: 'SET_PARAMETER', nodeType: 'noise', paramName: 'scale', value: 4.0 });
  } else if (t.includes('smoother') || t.includes('softer') || t.includes('less detail')) {
    understood.push('Decrease spatial detail (noise scale)');
    mutations.push({ type: 'SET_PARAMETER', nodeType: 'noise', paramName: 'scale', value: 1.0 });
  }

  // 2. Motion / Time Mapping
  if (t.includes('faster') || t.includes('quicker')) {
    understood.push('Increase temporal frequency');
    mutations.push({ type: 'SET_PARAMETER', nodeType: 'sine', paramName: 'frequency', value: 1.0 });
  } else if (t.includes('slower') || t.includes('calmer')) {
    understood.push('Decrease temporal frequency');
    mutations.push({ type: 'SET_PARAMETER', nodeType: 'sine', paramName: 'frequency', value: 0.1 });
  } else if (t.includes('more fluid')) {
    understood.push('Fluid motion (domain warping & low noise scale)');
    mutations.push({ type: 'SET_PARAMETER', nodeType: 'noise', paramName: 'scale', value: 1.2 });
    mutations.push({ type: 'SET_PARAMETER', nodeType: 'sine', paramName: 'frequency', value: 0.2 });
  }

  // 3. Color / Palette Mapping
  if (t.includes('cyan') || t.includes('blue')) {
    understood.push('Apply cool cyan/blue palette');
    mutations.push({ type: 'SET_PARAMETER', nodeType: 'color', paramName: 'r', value: 0.1 });
    mutations.push({ type: 'SET_PARAMETER', nodeType: 'color', paramName: 'g', value: 0.4 });
    mutations.push({ type: 'SET_PARAMETER', nodeType: 'color', paramName: 'b', value: 0.8 });
  } else if (t.includes('purple') || t.includes('violet') || t.includes('magenta')) {
    understood.push('Apply purple/magenta palette');
    mutations.push({ type: 'SET_PARAMETER', nodeType: 'color', paramName: 'r', value: 0.5 });
    mutations.push({ type: 'SET_PARAMETER', nodeType: 'color', paramName: 'g', value: 0.1 });
    mutations.push({ type: 'SET_PARAMETER', nodeType: 'color', paramName: 'b', value: 0.6 });
  } else if (t.includes('warm') || t.includes('red') || t.includes('orange')) {
    understood.push('Apply warm red/orange palette');
    mutations.push({ type: 'SET_PARAMETER', nodeType: 'color', paramName: 'r', value: 0.8 });
    mutations.push({ type: 'SET_PARAMETER', nodeType: 'color', paramName: 'g', value: 0.3 });
    mutations.push({ type: 'SET_PARAMETER', nodeType: 'color', paramName: 'b', value: 0.1 });
  }

  // 4. Operations
  if (t.includes('multiply')) {
    understood.push('Multiply signals');
    mutations.push({ type: 'SET_PARAMETER', nodeType: 'math', paramName: 'operation', value: 'multiply' });
  } else if (t.includes('add')) {
    understood.push('Add signals');
    mutations.push({ type: 'SET_PARAMETER', nodeType: 'math', paramName: 'operation', value: 'add' });
  }

  // 5. Semantic Additions (e.g. "add a sine wave")
  if (t.match(/add a sine wave/)) {
    understood.push('Instantiate Sine oscillator');
    mutations.push({ type: 'ADD_NODE', nodeType: 'sine' });
  }
  if (t.match(/add displacement/)) {
    understood.push('Instantiate Displacement node');
    mutations.push({ type: 'ADD_NODE', nodeType: 'displacement' });
  }

  return {
    confidence: mutations.length > 0 ? 0.8 : 0,
    understood,
    mutations
  };
}

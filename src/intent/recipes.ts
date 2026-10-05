import type { Graph } from '../core/types';
import type { IntentResult, IntentMutation } from './types';

export function applyRecipe(recipeName: string, _graph: Graph): IntentResult {
  const understood: string[] = [];
  const mutations: IntentMutation[] = [];

  // Currently, our macro recipe completely clears and rebuilds the standard generative aurora,
  // or it just sets it up if empty. To make it a true macro, we sequence the nodes.
  
  if (recipeName === 'AURORA') {
    understood.push('Generated flowing aurora structure');
    understood.push('Deep blue-purple palette');
    understood.push('Fluid domain warping');

    // To cleanly build a new macro without conflicting with old IDs, we'd normally clear or isolate.
    // For this prototype, we'll issue the sequence of mutations to construct the base graph.
    // However, if we just want to reset to an aurora, a special macro mutation is safest.
    mutations.push({ type: 'ADD_NODE', nodeType: 'uv' });
    mutations.push({ type: 'ADD_NODE', nodeType: 'time' });
    mutations.push({ type: 'ADD_NODE', nodeType: 'noise' });
    mutations.push({ type: 'ADD_NODE', nodeType: 'sine' });
    mutations.push({ type: 'ADD_NODE', nodeType: 'math' });
    mutations.push({ type: 'ADD_NODE', nodeType: 'color' });
    
    // We rely on MACRO_COMBINE_SIGNALS to stitch it for us, or we just rely on standard naming
    mutations.push({ type: 'SET_PARAMETER', nodeType: 'noise', paramName: 'scale', value: 1.5 });
    mutations.push({ type: 'SET_PARAMETER', nodeType: 'sine', paramName: 'frequency', value: 0.2 });
    mutations.push({ type: 'MACRO_COMBINE_SIGNALS' } as any);
  }

  return {
    confidence: 1.0,
    understood,
    mutations,
    recipe: recipeName
  };
}

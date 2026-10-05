import type { Graph } from '../core/types';
import type { IntentResult } from './types';
import { applyRecipe } from './recipes';
import { getSemanticMutations } from './semanticMapper';

export function parseIntent(text: string, currentGraph: Graph): IntentResult {
  const t = text.trim().toLowerCase();
  
  // 1. Check for complete Recipes first
  const recipeMatch = tryMatchRecipe(t);
  if (recipeMatch) {
    return applyRecipe(recipeMatch, currentGraph);
  }

  // 2. Check for explicit structural commands (fallback to original strict regex for deterministic tests)
  const explicit = parseExplicitCommand(t);
  if (explicit) {
    return explicit;
  }

  // 3. Perform semantic parsing
  const semantic = getSemanticMutations(t, currentGraph);
  if (semantic.mutations.length > 0) {
    return semantic;
  }

  // 4. Fallback (Smart Explanation)
  return {
    confidence: 0,
    understood: [`Could not confidently map "${text}" to specific shader nodes.`],
    mutations: []
  };
}

function tryMatchRecipe(t: string): string | null {
  if (t.includes('flowing') && (t.includes('aurora') || t.includes('energy') || t.includes('cloud'))) return 'AURORA';
  if (t.includes('wave') && t.includes('pattern')) return 'WAVE';
  if (t.includes('smooth noise') || t.includes('organic texture')) return 'SMOOTH_NOISE';
  return null;
}

function parseExplicitCommand(t: string): IntentResult | null {
  if (t === 'combine the signals' || t === 'combine noise and sine') {
    return {
      confidence: 1.0,
      understood: ['Combine noise and sine waves structurally'],
      mutations: [{ type: 'MACRO_COMBINE_SIGNALS' } as any]
    };
  }

  let m = t.match(/^create\s+(?:a\s+)?([a-z_]+(?:\s+[0-9]+)?)(?:\s+node)?$/);
  if (m) {
    return {
      confidence: 1.0,
      understood: [`Create ${m[1]} node`],
      mutations: [{ type: 'ADD_NODE', nodeType: m[1].replace(/\s+/g, '_') }]
    };
  }

  m = t.match(/^connect\s+(?:the\s+)?([a-z_]+(?:\s+[0-9]+)?)\s+to\s+(?:the\s+)?([a-z_]+(?:\s+[0-9]+)?)$/);
  if (m) {
    return {
      confidence: 1.0,
      understood: [`Connect ${m[1]} to ${m[2]}`],
      mutations: [{ type: 'ADD_CONNECTION', sourceNodeType: m[1].replace(/\s+/g, '_'), targetNodeType: m[2].replace(/\s+/g, '_') }]
    };
  }

  m = t.match(/^(?:change|increase|decrease)\s+(?:the\s+)?([a-z_]+(?:\s+[0-9]+)?)\s+([a-z0-9_]+)\s+to\s+([a-z0-9.\-]+)$/);
  if (m) {
    const valStr = m[3];
    const valNum = parseFloat(valStr);
    const value = isNaN(valNum) ? valStr : valNum;
    return { 
      confidence: 1.0,
      understood: [`Set ${m[1]} ${m[2]} to ${value}`],
      mutations: [{ type: 'SET_PARAMETER', nodeType: m[1].replace(/\s+/g, '_'), paramName: m[2], value }]
    };
  }

  return null;
}

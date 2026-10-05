import './style.css';
import { Renderer } from './renderer';
import { UIManager } from './ui';
import { parseIntent, executeMutations } from './intent';
import { compileGraph } from './core/compiler';
import type { Graph } from './core/types';

// Initial static demo state
const initialGraph: Graph = {
  nodes: {
    uv_1: { id: 'uv_1', type: 'uv', parameters: {} },
    time_1: { id: 'time_1', type: 'time', parameters: {} },
    noise_1: { id: 'noise_1', type: 'noise', parameters: { scale: 1.5 } },
    sine_1: { id: 'sine_1', type: 'sine', parameters: { frequency: 0.2, amplitude: 1.5 } },
    math_1: { id: 'math_1', type: 'math', parameters: { operation: 'add' } },
    color_1: { id: 'color_1', type: 'color', parameters: { r: 1.0, g: 1.0, b: 1.0, a: 1.0 } }
  },
  connections: [
    { sourceNode: 'uv_1', sourcePort: 'out', targetNode: 'noise_1', targetPort: 'uv' },
    { sourceNode: 'time_1', sourcePort: 'out', targetNode: 'sine_1', targetPort: 'in' },
    { sourceNode: 'noise_1', sourcePort: 'out', targetNode: 'math_1', targetPort: 'a' },
    { sourceNode: 'sine_1', sourcePort: 'out', targetNode: 'math_1', targetPort: 'b' },
    { sourceNode: 'math_1', sourcePort: 'out', targetNode: 'color_1', targetPort: 'in' }
  ]
};

function init() {
  const canvas = document.getElementById('glcanvas') as HTMLCanvasElement;
  const renderer = new Renderer(canvas);
  const ui = new UIManager();

  let graph = initialGraph;
  let lastKnownGoodGlsl = '';

  async function processCommand(cmdText: string) {
    ui.updateState({ graph, glsl: lastKnownGoodGlsl, status: 'planning' });
    
    // Simulate natural language processing delay for UX
    await new Promise(r => setTimeout(r, 400));
    
    const intentResult = parseIntent(cmdText, graph);
    
    if (intentResult.mutations.length === 0) {
       ui.addIntentHistory(cmdText, intentResult.understood, "No graph changes applied.", false);
       ui.updateState({ graph, glsl: lastKnownGoodGlsl, status: 'error' });
       return;
    }

    ui.updateState({ graph, glsl: lastKnownGoodGlsl, status: 'applying' });
    await new Promise(r => setTimeout(r, 300));

    const execResult = executeMutations(graph, intentResult.mutations);
    
    if (!execResult.success) {
      ui.addIntentHistory(cmdText, intentResult.understood, `Mutation failed: ${execResult.message}`, false);
      ui.updateState({ graph, glsl: lastKnownGoodGlsl, status: 'error' });
      return;
    }

    // Speculatively compile the new graph
    const compiled = compileGraph(execResult.graph);
    
    if (compiled.isFallback) {
      // Validation failed or compilation failed! Reject the mutation.
      const errorMessage = compiled.errors ? compiled.errors.map(e => e.message).join(', ') : "Compilation failed.";
      ui.addIntentHistory(cmdText, intentResult.understood, `Invalid structure: ${errorMessage}. Previous valid shader preserved.`, false);
      ui.updateState({ graph, glsl: lastKnownGoodGlsl, status: 'last known good' });
    } else {
      // Valid mutation! Commit graph and shader.
      graph = execResult.graph;
      lastKnownGoodGlsl = compiled.glsl;
      renderer.updateShader(compiled.glsl);
      ui.addIntentHistory(cmdText, intentResult.understood, `Graph mutated. Shader recompiled. GPU updated.`, true);
      ui.updateState({ graph, glsl: compiled.glsl, status: 'compiled' });
    }
  }

  // Bind UI commands
  ui.onCommand(processCommand);
  
  ui.onAction((action) => {
    if (action === 'clear') {
      graph = { nodes: {}, connections: [] };
      const compiled = compileGraph(graph);
      lastKnownGoodGlsl = compiled.glsl;
      renderer.updateShader(compiled.glsl);
      ui.updateState({ graph, glsl: compiled.glsl, status: 'ready' });
    } else if (action === 'fit') {
      // Just re-render to trigger layout computation
      ui.updateState({ graph, glsl: lastKnownGoodGlsl, status: 'compiled' });
    }
  });
  
  // Initial render with the default demo graph
  const compiled = compileGraph(graph);
  lastKnownGoodGlsl = compiled.glsl;
  renderer.updateShader(compiled.glsl);
  ui.updateState({ graph, glsl: compiled.glsl, status: 'compiled' });
}

// Start the app
init();

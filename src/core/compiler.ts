import type { Graph } from './types';
import { validateGraph, topologicalSort } from './validation';
import { nodeDefinitions } from '../nodes/index';

export interface CompilationResult {
  glsl: string;
  isFallback: boolean;
  errors?: any[];
}

let lastKnownGoodShader: string = `
void main() {
  gl_FragColor = vec4(1.0, 0.0, 1.0, 1.0); // Default magenta fallback
}
`;

export function compileGraph(graph: Graph): CompilationResult {
  const validation = validateGraph(graph);
  
  if (!validation.isValid) {
    return {
      glsl: lastKnownGoodShader,
      isFallback: true,
      errors: validation.errors
    };
  }

  try {
    const sortedNodes = topologicalSort(graph);
    
    let glsl = '';
    glsl += '// --- Generated ShaderFlow GLSL ---\n\n';
    
    // In a real application, you'd collect uniforms and varyings dynamically.
    // We add some defaults required by our node definitions.
    glsl += 'precision highp float;\n';
    glsl += 'varying vec2 v_uv;\n';
    glsl += 'varying vec3 v_position;\n';
    glsl += 'varying vec3 v_normal;\n';
    glsl += 'uniform float u_time;\n\n';
    
    // Add helpers from active nodes
    const activeHelpers = new Set<string>();
    for (const nodeId in graph.nodes) {
      const type = graph.nodes[nodeId].type;
      if (nodeDefinitions[type]?.helpers) {
        activeHelpers.add(nodeDefinitions[type].helpers);
      }
    }
    
    activeHelpers.forEach(helperCode => {
      glsl += `${helperCode}\n`;
    });

    glsl += '\nvoid main() {\n';
    
    // IR generation and code emission
    const portVariables: Record<string, string> = {}; // Tracks connection variables

    for (const nodeId of sortedNodes) {
      const node = graph.nodes[nodeId];
      const def = nodeDefinitions[node.type];
      
      const inputs: Record<string, string> = {};
      
      // Resolve inputs based on incoming connections
      for (const input of def.inputs) {
        const incomingConnection = graph.connections.find(c => c.targetNode === nodeId && c.targetPort === input.id);
        if (incomingConnection) {
          inputs[input.id] = portVariables[`${incomingConnection.sourceNode}_${incomingConnection.sourcePort}`];
        } else {
          // Unconnected inputs - use defaults based on type
          inputs[input.id] = getDefaultTypeString(input.type);
        }
      }
      
      // Generate GLSL for node
      const expression = def.glslTemplate(inputs, { ...def.defaultParameters, ...node.parameters });
      
      // Currently, most nodes have a single output named "out".
      // We assign the expression to a variable matching the node+port.
      for (const output of def.outputs) {
        const varName = `${nodeId}_${output.id}`;
        portVariables[varName] = varName;
        
        const typeStr = output.type;
        glsl += `  ${typeStr} ${varName} = ${expression};\n`;
      }
    }
    
    // Final output. In a real system, there'd be an explicit "Output" node.
    // For now, let's find a color node or displacement node to end with, or just default.
    const colorNode = [...sortedNodes].reverse().find(n => graph.nodes[n].type === 'color' || graph.nodes[n].type === 'math');
    if (colorNode) {
      const outVar = `${colorNode}_out`;
      // Check type of output
      const nodeDef = nodeDefinitions[graph.nodes[colorNode].type];
      if (nodeDef.outputs[0].type === 'vec4') {
        glsl += `\n  gl_FragColor = ${outVar};\n`;
      } else if (nodeDef.outputs[0].type === 'vec3') {
        glsl += `\n  gl_FragColor = vec4(${outVar}, 1.0);\n`;
      } else {
        glsl += `\n  gl_FragColor = vec4(vec3(${outVar}), 1.0);\n`;
      }
    } else {
      glsl += `\n  gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);\n`;
    }

    glsl += '}\n';

    // Store as last known good
    lastKnownGoodShader = glsl;

    return { glsl, isFallback: false };
    
  } catch (err: any) {
    return {
      glsl: lastKnownGoodShader,
      isFallback: true,
      errors: [{ code: 'COMPILATION_ERROR', message: err.message }]
    };
  }
}

function getDefaultTypeString(type: string): string {
  switch (type) {
    case 'float': return '0.0';
    case 'vec2': return 'vec2(0.0)';
    case 'vec3': return 'vec3(0.0)';
    case 'vec4': return 'vec4(0.0)';
    default: return '0.0';
  }
}

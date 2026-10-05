import type { Graph, Connection, GraphNode } from '../core/types';
import { nodeDefinitions } from '../nodes/index';
import { addNode, addConnection, removeConnection, setParameter } from '../core/mutation';
import type { IntentMutation } from './types';

export interface CommandExecutionResult {
  graph: Graph;
  success: boolean;
  message: string;
}

function findNodeByString(graph: Graph, target: string): GraphNode | undefined {
  // Try exact ID match first (e.g. noise_1 if parser sent noise_1, or noise1)
  const normalizedTarget = target.toLowerCase();
  
  // Exact match
  const exact = Object.values(graph.nodes).find(n => n.id.toLowerCase() === normalizedTarget || n.id.toLowerCase().replace('_', '') === normalizedTarget);
  if (exact) return exact;

  // Fallback to latest type
  const nodes = Object.values(graph.nodes).filter(n => n.type.toLowerCase() === normalizedTarget);
  return nodes.length > 0 ? nodes[nodes.length - 1] : undefined;
}

export function executeMutations(graph: Graph, mutations: IntentMutation[]): CommandExecutionResult {
  let currentGraph = graph;
  let finalMessage = '';

  for (const intent of mutations) {

    if (intent.type === 'ADD_NODE') {
      if (!nodeDefinitions[intent.nodeType!]) {
        return { graph: currentGraph, success: false, message: `Node type '${intent.nodeType}' does not exist.` };
      }
      const count = Object.values(currentGraph.nodes).filter(n => n.type === intent.nodeType).length;
      const id = `${intent.nodeType}_${count + 1}`;
      
      const res = addNode(currentGraph, { id, type: intent.nodeType!, parameters: {} });
      if (!res.valid) return { graph: currentGraph, success: false, message: `Failed to add node: ${res.errors[0]?.message}` };
      currentGraph = res.graph;
      finalMessage += `Added ${id.replace('_', ' ')} node. `;
    } else if (intent.type === 'ADD_CONNECTION') {
      const srcNode = findNodeByString(currentGraph, intent.sourceNodeType!);
      const tgtNode = findNodeByString(currentGraph, intent.targetNodeType!);
      if (!srcNode) return { graph: currentGraph, success: false, message: `Source node '${intent.sourceNodeType}' not found in graph.` };
      if (!tgtNode) return { graph: currentGraph, success: false, message: `Target node '${intent.targetNodeType}' not found in graph.` };

      const srcDef = nodeDefinitions[srcNode.type];
      const tgtDef = nodeDefinitions[tgtNode.type];

      if (srcDef.outputs.length === 0) return { graph: currentGraph, success: false, message: `Source node '${intent.sourceNodeType}' has no outputs.` };
      
      const sourcePort = srcDef.outputs[0].id;
      const outType = srcDef.outputs[0].type;
      
      const compatibleInput = tgtDef.inputs.find(i => i.type === outType);
      if (!compatibleInput) return { graph: currentGraph, success: false, message: `No compatible input port on '${intent.targetNodeType}' for type '${outType}'.` };

      const connection: Connection = {
        sourceNode: srcNode.id,
        sourcePort,
        targetNode: tgtNode.id,
        targetPort: compatibleInput.id
      };

      const res = addConnection(currentGraph, connection);
      if (!res.valid) return { graph: currentGraph, success: false, message: `Failed to connect: ${res.errors[0]?.message}` };
      currentGraph = res.graph;
      finalMessage += `Connected ${srcNode.id.replace('_', ' ')} to ${tgtNode.id.replace('_', ' ')}. `;
    } else if (intent.type === 'REMOVE_CONNECTION') {
      const srcNode = findNodeByString(currentGraph, intent.sourceNodeType!);
      const tgtNode = findNodeByString(currentGraph, intent.targetNodeType!);
      if (!srcNode || !tgtNode) return { graph: currentGraph, success: false, message: 'Source or target node not found.' };

      const conn = currentGraph.connections.find(c => c.sourceNode === srcNode.id && c.targetNode === tgtNode.id);
      if (!conn) return { graph: currentGraph, success: false, message: `No connection found from ${intent.sourceNodeType} to ${intent.targetNodeType}.` };

      const res = removeConnection(currentGraph, conn);
      if (!res.valid) return { graph: currentGraph, success: false, message: `Failed to remove connection: ${res.errors[0]?.message}` };
      currentGraph = res.graph;
      finalMessage += `Removed connection from ${srcNode.id.replace('_', ' ')} to ${tgtNode.id.replace('_', ' ')}. `;
    } else if (intent.type === 'SET_PARAMETER') {
      const node = findNodeByString(currentGraph, intent.nodeType!);
      if (!node) return { graph: currentGraph, success: false, message: `Node '${intent.nodeType}' not found in graph.` };
      
      const res = setParameter(currentGraph, node.id, intent.paramName!, intent.value);
      if (!res.valid) return { graph: currentGraph, success: false, message: `Failed to set parameter: ${res.errors[0]?.message}` };
      currentGraph = res.graph;
      finalMessage += `Set ${node.id.replace('_', ' ')} ${intent.paramName} to ${intent.value}. `;
    } else if (intent.type as any === 'MACRO_COMBINE_SIGNALS') {
      const noiseNode = findNodeByString(currentGraph, 'noise');
      const sineNode = findNodeByString(currentGraph, 'sine');
      
      if (!noiseNode || !sineNode) {
        return { graph: currentGraph, success: false, message: `Need both 'noise' and 'sine' nodes in the graph to combine them.` };
      }

      const mathCount = Object.values(currentGraph.nodes).filter(n => n.type === 'math').length;
      const mathId = `math_${mathCount + 1}`;
      let res = addNode(currentGraph, { id: mathId, type: 'math', parameters: { operation: 'add' } });
      if (!res.valid) return { graph: currentGraph, success: false, message: `Failed to create math node.` };
      
      res = addConnection(res.graph, { sourceNode: noiseNode.id, sourcePort: 'out', targetNode: mathId, targetPort: 'a' });
      res = addConnection(res.graph, { sourceNode: sineNode.id, sourcePort: 'out', targetNode: mathId, targetPort: 'b' });

      if (!res.valid) return { graph: currentGraph, success: false, message: `Failed to combine signals.` };

      let colorNode = findNodeByString(res.graph, 'color');
      if (!colorNode) {
        const colorCount = Object.values(res.graph.nodes).filter(n => n.type === 'color').length;
        const colorId = `color_${colorCount + 1}`;
        res = addNode(res.graph, { id: colorId, type: 'color', parameters: {} });
        colorNode = res.graph.nodes[colorId];
      }

      res = addConnection(res.graph, { sourceNode: mathId, sourcePort: 'out', targetNode: colorNode.id, targetPort: 'in' });
      currentGraph = res.graph;
      finalMessage += `Combined noise and sine signals. `;
    } else {
      return { graph: currentGraph, success: false, message: 'Unimplemented intent type.' };
    }
  }

  return { graph: currentGraph, success: true, message: finalMessage.trim() || 'Applied intent.' };
}

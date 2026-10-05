import type { Graph, ValidationResult, ValidationError } from './types';
import { nodeDefinitions } from '../nodes/index';

export function validateGraph(graph: Graph): ValidationResult {
  const errors: ValidationError[] = [];
  const connectionSet = new Set<string>();

  // Check structure
  if (!graph || typeof graph !== 'object' || !graph.nodes || !graph.connections) {
    errors.push({ code: 'INVALID_STRUCTURE', message: 'Graph must contain nodes and connections' });
    return { isValid: false, errors };
  }

  // Validate nodes
  for (const nodeId in graph.nodes) {
    const node = graph.nodes[nodeId];
    if (!nodeDefinitions[node.type]) {
      errors.push({ code: 'INVALID_STRUCTURE', message: `Unknown node type: ${node.type}`, nodeId });
    }
  }

  // Validate connections
  for (const conn of graph.connections) {
    const connKey = `${conn.targetNode}:${conn.targetPort}`;
    if (connectionSet.has(connKey)) {
      errors.push({ code: 'DUPLICATE_CONNECTION', message: 'Target port already has a connection', connection: conn });
    }
    connectionSet.add(connKey);

    const sourceNode = graph.nodes[conn.sourceNode];
    const targetNode = graph.nodes[conn.targetNode];

    if (!sourceNode) {
      errors.push({ code: 'MISSING_NODE', message: `Source node not found: ${conn.sourceNode}`, connection: conn, nodeId: conn.sourceNode });
      continue;
    }
    if (!targetNode) {
      errors.push({ code: 'MISSING_NODE', message: `Target node not found: ${conn.targetNode}`, connection: conn, nodeId: conn.targetNode });
      continue;
    }

    const sourceDef = nodeDefinitions[sourceNode.type];
    const targetDef = nodeDefinitions[targetNode.type];

    if (sourceDef && targetDef) {
      const sourcePort = sourceDef.outputs.find(p => p.id === conn.sourcePort);
      const targetPort = targetDef.inputs.find(p => p.id === conn.targetPort);

      if (!sourcePort) {
        errors.push({ code: 'MISSING_PORT', message: `Source port not found: ${conn.sourcePort}`, connection: conn, nodeId: conn.sourceNode, portId: conn.sourcePort });
      }
      if (!targetPort) {
        errors.push({ code: 'MISSING_PORT', message: `Target port not found: ${conn.targetPort}`, connection: conn, nodeId: conn.targetNode, portId: conn.targetPort });
      }

      if (sourcePort && targetPort && sourcePort.type !== targetPort.type) {
        errors.push({ 
          code: 'INCOMPATIBLE_TYPE', 
          message: `Expected ${targetPort.type}, received ${sourcePort.type} for ${targetNode.type} -> ${targetPort.name}`, 
          connection: conn 
        });
      }
    }
  }

  // Cycle detection
  const adjacencyList: Record<string, string[]> = {};
  for (const nodeId in graph.nodes) {
    adjacencyList[nodeId] = [];
  }
  for (const conn of graph.connections) {
    if (adjacencyList[conn.sourceNode]) {
      adjacencyList[conn.sourceNode].push(conn.targetNode);
    }
  }

  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  const detectCycle = (nodeId: string): boolean => {
    if (!visited.has(nodeId)) {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      for (const neighbor of adjacencyList[nodeId] || []) {
        if (!visited.has(neighbor) && detectCycle(neighbor)) {
          return true;
        } else if (recursionStack.has(neighbor)) {
          errors.push({ code: 'CYCLE_DETECTED', message: `Cycle detected involving node ${neighbor}`, nodeId: neighbor });
          return true;
        }
      }
    }
    recursionStack.delete(nodeId);
    return false;
  };

  for (const nodeId in graph.nodes) {
    if (!visited.has(nodeId)) {
      detectCycle(nodeId);
    }
  }

  return { isValid: errors.length === 0, errors };
}

export function topologicalSort(graph: Graph): string[] {
  // Assuming the graph is valid and acyclic
  const adjacencyList: Record<string, string[]> = {};
  const inDegree: Record<string, number> = {};
  
  // Sort node IDs to make the sort deterministic
  const sortedNodeIds = Object.keys(graph.nodes).sort();

  for (const nodeId of sortedNodeIds) {
    adjacencyList[nodeId] = [];
    inDegree[nodeId] = 0;
  }

  // To keep it deterministic, sort connections or just build adjacency deterministically
  const sortedConns = [...graph.connections].sort((a, b) => {
    return (a.sourceNode + a.sourcePort + a.targetNode + a.targetPort)
      .localeCompare(b.sourceNode + b.sourcePort + b.targetNode + b.targetPort);
  });

  for (const conn of sortedConns) {
    if (adjacencyList[conn.sourceNode]) {
      adjacencyList[conn.sourceNode].push(conn.targetNode);
      inDegree[conn.targetNode] = (inDegree[conn.targetNode] || 0) + 1;
    }
  }

  // Sort neighbors to maintain determinism
  for (const nodeId in adjacencyList) {
    adjacencyList[nodeId].sort();
  }

  const queue: string[] = [];
  for (const nodeId of sortedNodeIds) {
    if (inDegree[nodeId] === 0) {
      queue.push(nodeId);
    }
  }
  
  // Queue needs to be sorted for deterministic processing order when in-degrees tie
  queue.sort();

  const sorted: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);

    for (const neighbor of adjacencyList[current] || []) {
      inDegree[neighbor]--;
      if (inDegree[neighbor] === 0) {
        queue.push(neighbor);
        queue.sort(); // Keep queue sorted to ensure deterministic order among ties
      }
    }
  }

  return sorted;
}

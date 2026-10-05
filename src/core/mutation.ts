import type { Graph, GraphNode, Connection } from './types';
import { validateGraph } from './validation';

export function addNode(graph: Graph, node: GraphNode): { graph: Graph; valid: boolean; errors: any[] } {
  const newGraph = {
    ...graph,
    nodes: { ...graph.nodes, [node.id]: node },
  };
  const validation = validateGraph(newGraph);
  if (!validation.isValid) {
    return { graph, valid: false, errors: validation.errors };
  }
  return { graph: newGraph, valid: true, errors: [] };
}

export function removeNode(graph: Graph, nodeId: string): { graph: Graph; valid: boolean; errors: any[] } {
  if (!graph.nodes[nodeId]) {
    return { graph, valid: true, errors: [] }; // Already removed
  }
  
  const newNodes = { ...graph.nodes };
  delete newNodes[nodeId];
  
  // Also remove associated connections
  const newConnections = graph.connections.filter(c => c.sourceNode !== nodeId && c.targetNode !== nodeId);
  
  const newGraph = { nodes: newNodes, connections: newConnections };
  const validation = validateGraph(newGraph);
  
  if (!validation.isValid) {
    return { graph, valid: false, errors: validation.errors };
  }
  return { graph: newGraph, valid: true, errors: [] };
}

export function addConnection(graph: Graph, connection: Connection): { graph: Graph; valid: boolean; errors: any[] } {
  // Check if target port is already connected
  const existingIndex = graph.connections.findIndex(c => c.targetNode === connection.targetNode && c.targetPort === connection.targetPort);
  let newConnections = [...graph.connections];
  
  if (existingIndex >= 0) {
    // Replace connection to the same input port (an input can only have one connection)
    newConnections[existingIndex] = connection;
  } else {
    newConnections.push(connection);
  }
  
  const newGraph = { ...graph, connections: newConnections };
  const validation = validateGraph(newGraph);
  
  if (!validation.isValid) {
    return { graph, valid: false, errors: validation.errors };
  }
  return { graph: newGraph, valid: true, errors: [] };
}

export function removeConnection(graph: Graph, connection: Connection): { graph: Graph; valid: boolean; errors: any[] } {
  const newConnections = graph.connections.filter(c => 
    !(c.sourceNode === connection.sourceNode && 
      c.sourcePort === connection.sourcePort && 
      c.targetNode === connection.targetNode && 
      c.targetPort === connection.targetPort)
  );
  
  const newGraph = { ...graph, connections: newConnections };
  const validation = validateGraph(newGraph);
  
  if (!validation.isValid) {
    return { graph, valid: false, errors: validation.errors };
  }
  return { graph: newGraph, valid: true, errors: [] };
}

export function setParameter(graph: Graph, nodeId: string, paramName: string, value: any): { graph: Graph; valid: boolean; errors: any[] } {
  const node = graph.nodes[nodeId];
  if (!node) {
    return { graph, valid: false, errors: [{ code: 'MISSING_NODE', message: 'Node not found' }] };
  }

  const newNode = {
    ...node,
    parameters: {
      ...node.parameters,
      [paramName]: value
    }
  };

  const newGraph = {
    ...graph,
    nodes: {
      ...graph.nodes,
      [nodeId]: newNode
    }
  };

  const validation = validateGraph(newGraph);
  
  if (!validation.isValid) {
    return { graph, valid: false, errors: validation.errors };
  }
  return { graph: newGraph, valid: true, errors: [] };
}

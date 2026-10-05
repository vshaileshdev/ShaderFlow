export type PortType = 'float' | 'vec2' | 'vec3' | 'vec4';

export interface NodePort {
  id: string;
  name: string;
  type: PortType;
}

export interface NodeDefinition {
  type: string;
  inputs: NodePort[];
  outputs: NodePort[];
  defaultParameters: Record<string, any>;
  glslTemplate: (inputs: Record<string, string>, parameters: Record<string, any>) => string;
  helpers?: string;
}

export interface GraphNode {
  id: string;
  type: string;
  parameters: Record<string, any>;
}

export interface Connection {
  sourceNode: string;
  sourcePort: string;
  targetNode: string;
  targetPort: string;
}

export interface Graph {
  nodes: Record<string, GraphNode>;
  connections: Connection[];
}

export type ValidationErrorCode = 
  | 'MISSING_NODE' 
  | 'MISSING_PORT' 
  | 'INCOMPATIBLE_TYPE' 
  | 'DUPLICATE_CONNECTION' 
  | 'CYCLE_DETECTED' 
  | 'INVALID_STRUCTURE';

export interface ValidationError {
  code: ValidationErrorCode;
  message: string;
  nodeId?: string;
  portId?: string;
  connection?: Connection;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export interface AppState {
  graph: Graph;
  glsl: string;
  status: 'ready' | 'planning' | 'applying' | 'compiled' | 'compiling' | 'error' | 'last known good';
}

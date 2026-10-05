

export interface IntentMutation {
  type: 'ADD_NODE' | 'ADD_CONNECTION' | 'REMOVE_CONNECTION' | 'SET_PARAMETER' | 'REMOVE_NODE';
  nodeType?: string;
  sourceNodeType?: string;
  targetNodeType?: string;
  paramName?: string;
  value?: any;
}

export interface IntentResult {
  confidence: number;
  understood: string[];
  mutations: IntentMutation[];
  recipe?: string;
}

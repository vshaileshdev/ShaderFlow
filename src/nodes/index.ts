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
  helpers?: string;
  glslTemplate: (inputs: Record<string, string>, params: Record<string, any>) => string;
}

export const nodeDefinitions: Record<string, NodeDefinition> = {
  uv: {
    type: 'uv',
    inputs: [],
    outputs: [{ id: 'out', name: 'UV', type: 'vec2' }],
    defaultParameters: {},
    glslTemplate: () => `v_uv`,
  },
  position: {
    type: 'position',
    inputs: [],
    outputs: [{ id: 'out', name: 'Position', type: 'vec3' }],
    defaultParameters: {},
    glslTemplate: () => `v_position`,
  },
  time: {
    type: 'time',
    inputs: [],
    outputs: [{ id: 'out', name: 'Time', type: 'float' }],
    defaultParameters: {},
    glslTemplate: () => `u_time`,
  },
  noise: {
    type: 'noise',
    inputs: [{ id: 'uv', name: 'UV', type: 'vec2' }],
    outputs: [{ id: 'out', name: 'Value', type: 'float' }],
    defaultParameters: { scale: 3.0 },
    helpers: `
// Simplex 2D noise
vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
float snoise(vec2 v){
  const vec4 C = vec4(0.2113248, 0.3660254, -0.5773502, 0.0243902);
  vec2 i  = floor(v + dot(v, C.yy) );
  vec2 x0 = v -   i + dot(i, C.xx);
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
  + i.x + vec3(0.0, i1.x, 1.0 ));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m ;
  m = m*m ;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.7928429 - 0.8537347 * ( a0*a0 + h*h );
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}
// Fractal Brownian Motion for Fluid Flow
float fbm(vec2 p, float t) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    vec2 shift = vec2(100.0);
    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
    for (int i = 0; i < 5; i++) {
        value += amplitude * snoise(p * frequency + t * frequency);
        p = rot * p * 2.0 + shift;
        amplitude *= 0.5;
    }
    return value;
}
    `,
    glslTemplate: (inputs, params) => {
      // Use parameter formatting carefully to support integer and float forms uniformly
      const scale = typeof params.scale === 'number' ? params.scale.toFixed(5) : params.scale;
      return `fbm((${inputs.uv || 'v_uv'}) * ${scale}, u_time * 0.1)`;
    }
  },
  sine: {
    type: 'sine',
    inputs: [{ id: 'in', name: 'Input', type: 'float' }],
    outputs: [{ id: 'out', name: 'Value', type: 'float' }],
    defaultParameters: { frequency: 0.2, amplitude: 1.5 },
    glslTemplate: (inputs, params) => {
      const freq = typeof params.frequency === 'number' ? params.frequency.toFixed(5) : params.frequency;
      const amp = typeof params.amplitude === 'number' ? params.amplitude.toFixed(5) : params.amplitude;
      return `(sin((${inputs.in || '0.0'}) * ${freq}) * ${amp})`;
    }
  },
  math: {
    type: 'math',
    inputs: [
      { id: 'a', name: 'A', type: 'float' },
      { id: 'b', name: 'B', type: 'float' },
    ],
    outputs: [{ id: 'out', name: 'Value', type: 'float' }],
    defaultParameters: { operation: 'add' },
    glslTemplate: (inputs, params) => {
      const a = inputs.a || '0.0';
      const b = inputs.b || '0.0';
      if (params.operation === 'multiply') return `(${a} * ${b})`;
      if (params.operation === 'subtract') return `(${a} - ${b})`;
      return `(${a} + ${b})`;
    },
  },
  displacement: {
    type: 'displacement',
    inputs: [{ id: 'amount', name: 'Amount', type: 'float' }],
    outputs: [{ id: 'out', name: 'Position', type: 'vec3' }],
    defaultParameters: { strength: 1.0 },
    glslTemplate: (inputs, params) => `v_position + (v_normal * ${inputs.amount || '0.0'} * ${params.strength.toFixed(5)})`,
  },
  color: {
    type: 'color',
    inputs: [{ id: 'in', name: 'Intensity', type: 'float' }],
    outputs: [{ id: 'out', name: 'Color', type: 'vec4' }],
    defaultParameters: { r: 0.5, g: 0.5, b: 0.5, a: 1.0 },
    helpers: `
// Premium soft fluid palette
vec3 palette( in float t ) {
    vec3 a = vec3(0.1, 0.2, 0.3); // deep navy base
    vec3 b = vec3(0.2, 0.3, 0.4); // soft cyan/violet variation
    vec3 c = vec3(1.0, 1.0, 1.0); // frequency
    vec3 d = vec3(0.0, 0.15, 0.30); // phase shift
    return a + b * cos( 6.283185 * (c * t + d) );
}
    `,
    glslTemplate: (inputs, params) => {
      if (inputs.in) {
        // Unclamped periodic palette evaluation generates flowing contour bands
        return `vec4(palette(${inputs.in}), ${params.a.toFixed(5)})`;
      }
      return `vec4(${params.r.toFixed(5)}, ${params.g.toFixed(5)}, ${params.b.toFixed(5)}, ${params.a.toFixed(5)})`;
    }
  },
};

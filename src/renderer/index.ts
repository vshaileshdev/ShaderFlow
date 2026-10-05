import * as THREE from 'three';

export class Renderer {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private material: THREE.RawShaderMaterial;
  private mesh: THREE.Mesh;
  private startTime: number;

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    
    // Set up camera
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100);
    this.camera.position.z = 2;

    // Set up renderer with optimal settings
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Default Vertex Shader
    const vertexShader = `
      precision highp float;
      attribute vec3 position;
      attribute vec2 uv;
      attribute vec3 normal;
      uniform mat4 modelViewMatrix;
      uniform mat4 projectionMatrix;
      varying vec2 v_uv;
      varying vec3 v_position;
      varying vec3 v_normal;
      
      void main() {
        v_uv = uv;
        v_position = position;
        v_normal = normal;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    // Default Procedural Aesthetic Fallback
    const fragmentShader = `
      precision highp float;
      varying vec2 v_uv;
      uniform float u_time;
      
      vec3 palette( in float t, in vec3 a, in vec3 b, in vec3 c, in vec3 d ) {
          return a + b*cos( 6.283185*(c*t+d) );
      }
      
      void main() {
        vec2 uv = v_uv * 2.0 - 1.0;
        float d = length(uv) * exp(-length(uv));
        float wave = sin(d * 10.0 - u_time * 2.0) * 0.5 + 0.5;
        vec3 col = palette(wave, vec3(0.5,0.5,0.5), vec3(0.5,0.5,0.5), vec3(1.0,1.0,1.0), vec3(0.263,0.416,0.557));
        gl_FragColor = vec4(col * (1.0 - d*0.5), 1.0);
      }
    `;

    this.material = new THREE.RawShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        u_time: { value: 0.0 }
      },
      side: THREE.DoubleSide
    });

    const geometry = new THREE.PlaneGeometry(3, 3, 64, 64);
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.scene.add(this.mesh);

    this.startTime = performance.now();

    const resizeObserver = new ResizeObserver(() => this.onResize(canvas));
    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }
    this.onResize(canvas);
    
    this.animate();
  }

  public updateShader(fragmentShader: string) {
    this.material.fragmentShader = fragmentShader;
    this.material.needsUpdate = true;
  }

  private onResize(canvas: HTMLCanvasElement) {
    const parent = canvas.parentElement;
    if (parent) {
      const width = parent.clientWidth;
      const height = parent.clientHeight;
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height, false);
    }
  }

  private animate() {
    requestAnimationFrame(this.animate.bind(this));
    this.material.uniforms.u_time.value = (performance.now() - this.startTime) / 1000.0;
    this.renderer.render(this.scene, this.camera);
  }
}

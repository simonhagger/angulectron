import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

interface ParticleField {
  ctx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
}

const VERTEX_SHADER = `#version 300 es
in vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uAccent;
out vec4 outColor;

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float wx = sin(uv.x * 9.0 + uTime * 1.4) * 0.5 + 0.5;
  float wy = sin(uv.y * 7.0 - uTime * 1.1) * 0.5 + 0.5;
  float rings = sin((uv.x + uv.y) * 12.0 + uTime * 2.0) * 0.5 + 0.5;
  float v = clamp(wx * wy * 0.6 + rings * 0.4, 0.0, 1.0);
  vec3 base = vec3(0.055, 0.065, 0.095);
  outColor = vec4(mix(base, uAccent, v), 1.0);
}
`;

@Component({
  selector: 'app-canvas-lab-page',
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule],
  templateUrl: './canvas-lab-page.html',
  styleUrl: './canvas-lab-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CanvasLabPage {
  private readonly destroyRef = inject(DestroyRef);

  readonly waveCanvas =
    viewChild.required<ElementRef<HTMLCanvasElement>>('waveCanvas');
  readonly glCanvas =
    viewChild.required<ElementRef<HTMLCanvasElement>>('glCanvas');
  readonly offscreenCanvas =
    viewChild.required<ElementRef<HTMLCanvasElement>>('offscreenCanvas');

  readonly offscreenSupported = signal(false);
  readonly workerStatus = signal('Probing…');

  readonly density = signal(48);
  readonly speed = signal(10);
  readonly accent = signal('#38bdf8');
  readonly running = signal(true);
  readonly fps = signal(0);

  readonly webglAvailable = signal(false);
  readonly webgpuAvailable = signal(
    typeof navigator !== 'undefined' && 'gpu' in navigator,
  );
  readonly gpuRenderer = signal('Probing…');
  readonly maxTextureSize = signal('N/A');

  private field: ParticleField | null = null;
  private gl: WebGL2RenderingContext | null = null;
  private glProgram: WebGLProgram | null = null;
  private glUniforms: {
    res: WebGLUniformLocation | null;
    time: WebGLUniformLocation | null;
    accent: WebGLUniformLocation | null;
  } | null = null;

  private rafHandle = 0;
  private frameCount = 0;
  private lastFpsTimestamp = performance.now();
  private resizeObserver: ResizeObserver | null = null;
  private startTime = performance.now();
  private renderWorker: Worker | null = null;
  private workerCanvas: OffscreenCanvas | null = null;

  constructor() {
    afterNextRender(() => this.initialize());
    this.destroyRef.onDestroy(() => this.teardown());

    effect(() => {
      const worker = this.renderWorker;
      if (!worker) {
        return;
      }
      worker.postMessage({
        type: 'params',
        density: this.density(),
        speed: this.speed(),
        accent: this.accent(),
        running: this.running(),
      });
    });
  }

  setDensity(value: number): void {
    this.density.set(value);
  }

  setSpeed(value: number): void {
    this.speed.set(value);
  }

  setAccent(color: string): void {
    this.accent.set(color);
  }

  toggleRunning(): void {
    const next = !this.running();
    this.running.set(next);
    if (next) {
      this.lastFpsTimestamp = performance.now();
      this.frameCount = 0;
      this.scheduleFrame();
    }
  }

  private initialize(): void {
    this.initParticleField();
    this.initWebGl();
    this.initOffscreenWorker();
    this.observeResize();
    this.scheduleFrame();

    this.destroyRef.onDestroy(() => {
      this.resizeObserver?.disconnect();
    });
  }

  private initOffscreenWorker(): void {
    const canvas = this.offscreenCanvas().nativeElement;
    if (typeof canvas.transferControlToOffscreen !== 'function') {
      this.workerStatus.set('OffscreenCanvas not supported here.');
      return;
    }
    if (typeof Worker === 'undefined') {
      this.workerStatus.set('Workers unavailable in this environment.');
      return;
    }

    try {
      this.workerCanvas = canvas.transferControlToOffscreen();
      this.renderWorker = new Worker(
        new URL('./render.worker.ts', import.meta.url),
        { type: 'module' },
      );
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.renderWorker.postMessage(
        {
          type: 'init',
          canvas: this.workerCanvas,
          width: Math.max(1, Math.floor(canvas.clientWidth * dpr)),
          height: Math.max(1, Math.floor(canvas.clientHeight * dpr)),
          density: this.density(),
          speed: this.speed(),
          accent: this.accent(),
          running: this.running(),
        },
        [this.workerCanvas],
      );
      this.offscreenSupported.set(true);
      this.workerStatus.set('Rendering in Web Worker via OffscreenCanvas.');
    } catch {
      this.workerStatus.set('Failed to start worker rendering.');
      this.renderWorker?.terminate();
      this.renderWorker = null;
      this.workerCanvas = null;
    }
  }

  private initParticleField(): void {
    const canvas = this.waveCanvas().nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    this.field = { ctx, canvas };
    this.resizeCanvas(canvas);
  }

  private initWebGl(): void {
    const canvas = this.glCanvas().nativeElement;
    const gl = canvas.getContext('webgl2', { antialias: true });
    if (!gl) {
      this.webglAvailable.set(false);
      this.gpuRenderer.set('WebGL2 unavailable in this environment.');
      return;
    }

    const program = this.compileProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER);
    if (!program) {
      this.webglAvailable.set(false);
      this.gpuRenderer.set('Shader compilation failed.');
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return;
    }

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );

    const loc = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.useProgram(program);

    this.gl = gl;
    this.glProgram = program;
    this.glUniforms = {
      res: gl.getUniformLocation(program, 'uRes'),
      time: gl.getUniformLocation(program, 'uTime'),
      accent: gl.getUniformLocation(program, 'uAccent'),
    };

    this.webglAvailable.set(true);
    this.resizeCanvas(canvas);
    this.readGpuCapabilities(gl);
  }

  private compileProgram(
    gl: WebGL2RenderingContext,
    vertexSource: string,
    fragmentSource: string,
  ): WebGLProgram | null {
    const compile = (type: number, source: string): WebGLShader | null => {
      const shader = gl.createShader(type);
      if (!shader) {
        return null;
      }
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vertex = compile(gl.VERTEX_SHADER, vertexSource);
    const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
    if (!vertex || !fragment) {
      return null;
    }

    const program = gl.createProgram();
    if (!program) {
      return null;
    }
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return null;
    }
    return program;
  }

  private readGpuCapabilities(gl: WebGL2RenderingContext): void {
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = debugInfo
      ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL))
      : String(gl.getParameter(gl.RENDERER));
    this.gpuRenderer.set(renderer);
    this.maxTextureSize.set(String(gl.getParameter(gl.MAX_TEXTURE_SIZE)));
  }

  private observeResize(): void {
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    this.resizeObserver = new ResizeObserver(() => {
      if (this.field) {
        this.resizeCanvas(this.field.canvas);
      }
      if (this.gl) {
        this.resizeCanvas(this.gl.canvas as HTMLCanvasElement);
        this.gl.viewport(
          0,
          0,
          this.gl.drawingBufferWidth,
          this.gl.drawingBufferHeight,
        );
      }
      const offscreenHost = this.offscreenCanvas().nativeElement;
      if (this.renderWorker && this.workerCanvas) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.renderWorker.postMessage({
          type: 'resize',
          width: Math.max(1, Math.floor(offscreenHost.clientWidth * dpr)),
          height: Math.max(1, Math.floor(offscreenHost.clientHeight * dpr)),
        });
      }
    });
    this.resizeObserver.observe(this.waveCanvas().nativeElement);
    this.resizeObserver.observe(this.glCanvas().nativeElement);
    this.resizeObserver.observe(this.offscreenCanvas().nativeElement);
  }

  private resizeCanvas(canvas: HTMLCanvasElement): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  private scheduleFrame(): void {
    if (!this.running()) {
      return;
    }
    this.rafHandle = requestAnimationFrame(() => this.renderFrame());
  }

  private renderFrame(): void {
    const elapsedSeconds = (performance.now() - this.startTime) / 1000;
    this.drawParticleField(elapsedSeconds);
    this.drawShaderQuad(elapsedSeconds);
    this.updateFps();

    this.scheduleFrame();
  }

  private drawParticleField(seconds: number): void {
    const field = this.field;
    if (!field) {
      return;
    }
    const { ctx, canvas } = field;
    const { width, height } = canvas;
    const speed = this.speed() / 10;
    const columns = this.density();
    const accent = this.accent();

    ctx.fillStyle = 'rgba(8, 11, 18, 0.28)';
    ctx.fillRect(0, 0, width, height);

    const stepX = width / columns;
    for (let i = 0; i < columns; i++) {
      const phase = seconds * speed + i * 0.35;
      const y =
        height / 2 +
        Math.sin(phase) * (height * 0.22) +
        Math.sin(phase * 2.3 + 1.7) * (height * 0.08);
      const x = i * stepX + stepX / 2;
      const radius = Math.max(1.5, stepX * 0.16);

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = accent;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(x, height - y, radius * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = `${accent}55`;
      ctx.fill();
    }
  }

  private drawShaderQuad(seconds: number): void {
    const gl = this.gl;
    const uniforms = this.glUniforms;
    if (!gl || !uniforms) {
      return;
    }
    if (uniforms.res) {
      gl.uniform2f(uniforms.res, gl.drawingBufferWidth, gl.drawingBufferHeight);
    }
    if (uniforms.time) {
      gl.uniform1f(uniforms.time, seconds);
    }
    if (uniforms.accent) {
      const [r, g, b] = this.hexToRgb(this.accent());
      gl.uniform3f(uniforms.accent, r, g, b);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private hexToRgb(hex: string): [number, number, number] {
    const value = Number.parseInt(hex.replace('#', ''), 16);
    return [
      ((value >> 16) & 255) / 255,
      ((value >> 8) & 255) / 255,
      (value & 255) / 255,
    ];
  }

  private updateFps(): void {
    this.frameCount++;
    const now = performance.now();
    const interval = now - this.lastFpsTimestamp;
    if (interval >= 500) {
      this.fps.set(Math.round((this.frameCount * 1000) / interval));
      this.frameCount = 0;
      this.lastFpsTimestamp = now;
    }
  }

  private teardown(): void {
    cancelAnimationFrame(this.rafHandle);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (this.gl) {
      this.gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
    this.renderWorker?.terminate();
    this.renderWorker = null;
    this.workerCanvas = null;
    this.gl = null;
    this.glProgram = null;
    this.glUniforms = null;
    this.field = null;
  }
}

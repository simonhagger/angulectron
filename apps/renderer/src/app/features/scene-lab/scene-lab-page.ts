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
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

@Component({
  selector: 'app-scene-lab-page',
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule],
  templateUrl: './scene-lab-page.html',
  styleUrl: './scene-lab-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SceneLabPage {
  private readonly destroyRef = inject(DestroyRef);

  readonly sceneCanvas =
    viewChild.required<ElementRef<HTMLCanvasElement>>('sceneCanvas');

  readonly rotationSpeed = signal(10);
  readonly wireframe = signal(true);
  readonly accent = signal('#38bdf8');
  readonly running = signal(true);
  readonly fps = signal(0);
  readonly webglReady = signal(false);

  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private controls: OrbitControls | null = null;
  private knot: THREE.Mesh<
    THREE.TorusKnotGeometry,
    THREE.MeshStandardMaterial
  > | null = null;
  private stars: THREE.Points<
    THREE.BufferGeometry,
    THREE.PointsMaterial
  > | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private rafHandle = 0;
  private frameCount = 0;
  private lastFpsTimestamp = performance.now();
  private lastFrameTimestamp = performance.now();

  constructor() {
    afterNextRender(() => this.initialize());
    this.destroyRef.onDestroy(() => this.teardown());

    effect(() => {
      const material = this.knot?.material;
      if (material) {
        material.color.set(this.accent());
        material.wireframe = this.wireframe();
      }
      if (this.stars) {
        this.stars.material.color.set(this.accent());
      }
    });
  }

  setRotationSpeed(value: number): void {
    this.rotationSpeed.set(value);
  }

  toggleWireframe(): void {
    this.wireframe.update((value) => !value);
  }

  toggleRunning(): void {
    const next = !this.running();
    this.running.set(next);
    if (next) {
      this.lastFrameTimestamp = performance.now();
      this.lastFpsTimestamp = performance.now();
      this.frameCount = 0;
      this.scheduleFrame();
    }
  }

  private initialize(): void {
    const canvas = this.sceneCanvas().nativeElement;
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x080b12);

    this.renderer = renderer;
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
    this.camera.position.set(0, 1.4, 6.5);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;

    const knotGeometry = new THREE.TorusKnotGeometry(1.5, 0.42, 220, 28);
    const knotMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(this.accent()),
      wireframe: this.wireframe(),
      metalness: 0.35,
      roughness: 0.45,
    });
    this.knot = new THREE.Mesh(knotGeometry, knotMaterial);
    this.scene.add(this.knot);

    const starCount = 900;
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i++) {
      positions[i] = (Math.random() - 0.5) * 40;
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(positions, 3),
    );
    const starMaterial = new THREE.PointsMaterial({
      color: new THREE.Color(this.accent()),
      size: 0.05,
      transparent: true,
      opacity: 0.7,
    });
    this.stars = new THREE.Points(starGeometry, starMaterial);
    this.scene.add(this.stars);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(4, 6, 5);
    this.scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0x8899ff, 0.9);
    rimLight.position.set(-5, -3, -4);
    this.scene.add(rimLight);

    this.webglReady.set(true);
    this.resizeToHost();
    this.observeResize();
    this.scheduleFrame();
  }

  private observeResize(): void {
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    this.resizeObserver = new ResizeObserver(() => this.resizeToHost());
    this.resizeObserver.observe(this.sceneCanvas().nativeElement);
  }

  private resizeToHost(): void {
    const canvas = this.sceneCanvas().nativeElement;
    const renderer = this.renderer;
    const camera = this.camera;
    if (!renderer || !camera) {
      return;
    }
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  private scheduleFrame(): void {
    if (!this.running()) {
      return;
    }
    this.rafHandle = requestAnimationFrame(() => this.renderFrame());
  }

  private renderFrame(): void {
    const now = performance.now();
    const dt = Math.min((now - this.lastFrameTimestamp) / 1000, 0.1);
    this.lastFrameTimestamp = now;

    if (this.knot) {
      this.knot.rotation.y += dt * (this.rotationSpeed() / 10);
      this.knot.rotation.x += dt * (this.rotationSpeed() / 10) * 0.35;
    }
    if (this.stars) {
      this.stars.rotation.y -= dt * 0.02;
    }
    this.controls?.update();

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
    this.updateFps(now);
    this.scheduleFrame();
  }

  private updateFps(now: number): void {
    this.frameCount++;
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
    this.controls?.dispose();
    this.knot?.geometry.dispose();
    this.knot?.material.dispose();
    this.stars?.geometry.dispose();
    this.stars?.material.dispose();
    this.scene?.clear();
    this.renderer?.dispose();
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.controls = null;
    this.knot = null;
    this.stars = null;
  }
}

/// <reference lib="webworker" />

interface InitMessage {
  type: 'init';
  canvas: OffscreenCanvas;
  width: number;
  height: number;
  density: number;
  speed: number;
  accent: string;
  running: boolean;
}

interface ParamsMessage {
  type: 'params';
  density?: number;
  speed?: number;
  accent?: string;
  running?: boolean;
}

interface ResizeMessage {
  type: 'resize';
  width: number;
  height: number;
}

type WorkerMessage = InitMessage | ParamsMessage | ResizeMessage;

interface Star {
  x: number;
  y: number;
  z: number;
}

let ctx: OffscreenCanvasRenderingContext2D | null = null;
let canvas: OffscreenCanvas | null = null;
const stars: Star[] = [];
let density = 48;
let speed = 10;
let accent = '#38bdf8';
let accentRgb: [number, number, number] = [0.22, 0.74, 0.97];
let running = true;
let lastTimestamp = 0;

function hexToRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  return [
    ((value >> 16) & 255) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255,
  ];
}

function seedStars(width: number, height: number): void {
  stars.length = 0;
  const count = density * 6;
  for (let i = 0; i < count; i++) {
    stars.push({
      x: (Math.random() - 0.5) * width,
      y: (Math.random() - 0.5) * height,
      z: Math.random(),
    });
  }
}

function drawStarfield(timestamp: number): void {
  if (!ctx || !canvas || !running) {
    requestAnimationFrame(drawStarfield);
    return;
  }

  const dt = Math.min((timestamp - lastTimestamp) / 1000, 0.1);
  lastTimestamp = timestamp;

  const { width, height } = canvas;
  ctx.fillStyle = 'rgba(8, 11, 18, 0.35)';
  ctx.fillRect(0, 0, width, height);

  const cx = width / 2;
  const cy = height / 2;
  const warp = speed * 60 * dt;

  for (const star of stars) {
    const prevZ = star.z;
    star.z -= (warp / Math.max(1, width)) * 2.2;
    if (star.z <= 0.02) {
      star.x = (Math.random() - 0.5) * width;
      star.y = (Math.random() - 0.5) * height;
      star.z = 1;
      continue;
    }

    const px = cx + (star.x / prevZ) * 0.08;
    const py = cy + (star.y / prevZ) * 0.08;
    const x = cx + (star.x / star.z) * 0.08;
    const y = cy + (star.y / star.z) * 0.08;

    if (x < 0 || y < 0 || x > width || y > height) {
      continue;
    }

    const alpha = 1 - star.z;
    const [r, g, b] = accentRgb;
    ctx.strokeStyle = `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${alpha.toFixed(3)})`;
    ctx.lineWidth = Math.max(1, (1 - star.z) * 2.5);

    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  requestAnimationFrame(drawStarfield);
}

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;

  if (message.type === 'init') {
    canvas = message.canvas;
    ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    canvas.width = Math.max(1, Math.floor(message.width));
    canvas.height = Math.max(1, Math.floor(message.height));
    density = message.density;
    speed = message.speed;
    accent = message.accent;
    accentRgb = hexToRgb(accent);
    running = message.running;
    seedStars(canvas.width, canvas.height);
    lastTimestamp = performance.now();
    requestAnimationFrame(drawStarfield);
    return;
  }

  if (message.type === 'params') {
    if (message.density !== undefined && message.density !== density) {
      density = message.density;
      if (canvas) {
        seedStars(canvas.width, canvas.height);
      }
    }
    if (message.speed !== undefined) {
      speed = message.speed;
    }
    if (message.accent !== undefined && message.accent !== accent) {
      accent = message.accent;
      accentRgb = hexToRgb(accent);
    }
    if (message.running !== undefined) {
      running = message.running;
      lastTimestamp = performance.now();
    }
    return;
  }

  if (message.type === 'resize' && canvas) {
    canvas.width = Math.max(1, Math.floor(message.width));
    canvas.height = Math.max(1, Math.floor(message.height));
    seedStars(canvas.width, canvas.height);
  }
};

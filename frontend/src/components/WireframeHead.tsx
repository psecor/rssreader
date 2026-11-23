import React, { useEffect, useRef } from 'react';

// Port of android-rss-app ui/common/WireframeHead.kt; keep the two in sync when tuning.

const DEPTH_BANDS = 6;
const DETAIL_BANDS = 3;
const NEURON_RGB = ['255,95,109', '91,227,154', '95,174,255'];

const POINT_COUNT = 2200;
const NEIGHBOURS = 4;
const MAX_EDGE = 0.4;
const Y_TOP = 0.995;
const Y_BOTTOM = -1.18;

// (y, halfWidth, frontDepth, backDepth) from crown to base of neck.
const PROFILE = [
  [1.0, 0.1, 0.1, 0.12],
  [0.93, 0.4, 0.42, 0.48],
  [0.8, 0.62, 0.64, 0.74],
  [0.6, 0.74, 0.76, 0.88],
  [0.35, 0.79, 0.8, 0.94],
  [0.1, 0.8, 0.8, 0.92],
  [-0.12, 0.78, 0.74, 0.84],
  [-0.35, 0.75, 0.74, 0.7],
  [-0.55, 0.66, 0.72, 0.52],
  [-0.72, 0.54, 0.7, 0.4],
  [-0.86, 0.42, 0.62, 0.34],
  [-0.98, 0.35, 0.38, 0.34],
  [-1.18, 0.38, 0.4, 0.4],
];

// (amplitude, thetaCenter, thetaSigma, yCenter, ySigma); theta 0 = straight ahead.
const FRONT_FEATURES = [
  [0.08, 0.0, 0.12, -0.3, 0.14], // nose bridge
  [0.17, 0.0, 0.22, -0.47, 0.09], // nose tip
  [-0.09, 0.4, 0.18, -0.16, 0.08], // eye socket
  [-0.09, -0.4, 0.18, -0.16, 0.08], // eye socket
  [0.05, 0.0, 0.7, -0.03, 0.06], // brow ridge
  [0.05, 0.8, 0.3, -0.32, 0.12], // cheekbone
  [0.05, -0.8, 0.3, -0.32, 0.12], // cheekbone
  [0.06, 0.0, 0.32, -0.64, 0.05], // lips
  [-0.04, 0.0, 0.26, -0.73, 0.04], // under-lip
  [0.08, 0.0, 0.3, -0.84, 0.07], // chin
];
const SIDE_FEATURES = [
  [0.1, 1.55, 0.2, -0.12, 0.2],
  [0.1, -1.55, 0.2, -0.12, 0.2],
];
const EYE_L = [0.1, 0.4, 0.14, -0.14, 0.05];
const EYE_R = [0.1, -0.4, 0.14, -0.14, 0.05];

interface HeadModel {
  n: number;
  mx: Float32Array;
  my: Float32Array;
  mz: Float32Array;
  detail: Float32Array;
  neuron: Int8Array; // index into NEURON_RGB, or -1
  edgeA: Int32Array;
  edgeB: Int32Array;
}

function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(f: number[], theta: number, y: number): number {
  const dt = (theta - f[1]) / f[2];
  const dy = (y - f[3]) / f[4];
  return f[0] * Math.exp(-0.5 * (dt * dt + dy * dy));
}

function profileAt(y: number): [number, number, number] {
  for (let i = 0; i < PROFILE.length - 1; i++) {
    const a = PROFILE[i];
    const b = PROFILE[i + 1];
    if (y <= a[0] && y >= b[0]) {
      let t = (a[0] - y) / (a[0] - b[0]);
      t = t * t * (3 - 2 * t);
      return [a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t];
    }
  }
  const last = PROFILE[PROFILE.length - 1];
  return [last[1], last[2], last[3]];
}

function surfacePoint(theta: number, y: number): [number, number, number] {
  const [w, f, b] = profileAt(y);
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  let radial = 1;
  if (c > 0) {
    let bump = 0;
    for (const feat of FRONT_FEATURES) bump += gaussian(feat, theta, y);
    radial += bump * c;
  }
  let side = 0;
  for (const feat of SIDE_FEATURES) side += gaussian(feat, theta, y);
  return [w * s * (1 + side * Math.abs(s)) * radial, y, (c >= 0 ? f : b) * c * radial];
}

function detailAt(theta: number, y: number): number {
  const c = Math.cos(theta);
  let d = 0;
  if (c > 0) {
    for (const feat of FRONT_FEATURES) d += Math.abs(gaussian(feat, theta, y)) * c;
    d += gaussian(EYE_L, theta, y) * c;
    d += gaussian(EYE_R, theta, y) * c;
  }
  let side = 0;
  for (const feat of SIDE_FEATURES) side += gaussian(feat, theta, y);
  d += side * Math.abs(Math.sin(theta));
  if (Math.abs(theta) < 0.1 && y > -0.98 && y < 0.45) d += 0.12;
  if (y < -0.95 && Math.abs(Math.sin(theta)) < 0.25) d += 0.06;
  return d;
}

function buildModel(): HeadModel {
  const rng = mulberry32(7);
  const xs: number[] = [];
  const ys: number[] = [];
  const zs: number[] = [];
  const ds: number[] = [];
  let tries = 0;
  while (xs.length < POINT_COUNT && tries < POINT_COUNT * 200) {
    tries++;
    const y = Y_BOTTOM + (Y_TOP - Y_BOTTOM) * rng();
    const theta = -Math.PI + 2 * Math.PI * rng();
    const d = detailAt(theta, y);
    let w = 0.14 + Math.min(1, d / 0.1) * 0.86;
    if (y > 0.3) w *= 0.7;
    if (rng() < w) {
      const [px, py, pz] = surfacePoint(theta, y);
      xs.push(px);
      ys.push(py);
      zs.push(pz);
      ds.push(Math.min(1, d / 0.2));
    }
  }
  const n = xs.length;
  const mx = Float32Array.from(xs);
  const my = Float32Array.from(ys);
  const mz = Float32Array.from(zs);

  const neuron = new Int8Array(n);
  for (let i = 0; i < n; i++) {
    const p = my[i] > -0.1 ? 0.07 : 0.02;
    neuron[i] = rng() < p ? Math.floor(rng() * NEURON_RGB.length) : -1;
  }

  // k-nearest-neighbour edges via a uniform grid.
  const cell = MAX_EDGE;
  // Bounds from the Float32 arrays, not xs/ys/zs: rounding could otherwise yield index -1.
  const minX = Math.min(...mx), minY = Math.min(...my), minZ = Math.min(...mz);
  const nx = Math.floor((Math.max(...mx) - minX) / cell) + 1;
  const ny = Math.floor((Math.max(...my) - minY) / cell) + 1;
  const nz = Math.floor((Math.max(...mz) - minZ) / cell) + 1;
  const grid: number[][] = Array.from({ length: nx * ny * nz }, () => []);
  const gridOf = (i: number) => [
    Math.floor((mx[i] - minX) / cell),
    Math.floor((my[i] - minY) / cell),
    Math.floor((mz[i] - minZ) / cell),
  ];
  for (let i = 0; i < n; i++) {
    const [gx, gy, gz] = gridOf(i);
    grid[(gz * ny + gy) * nx + gx].push(i);
  }

  const edges = new Set<number>();
  const bestD = new Float64Array(NEIGHBOURS);
  const bestJ = new Int32Array(NEIGHBOURS);
  const maxD2 = MAX_EDGE * MAX_EDGE;
  for (let i = 0; i < n; i++) {
    bestD.fill(Infinity);
    bestJ.fill(-1);
    const [gx, gy, gz] = gridOf(i);
    for (let dz = -1; dz <= 1; dz++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const cx = gx + dx, cy = gy + dy, cz = gz + dz;
          if (cx < 0 || cx >= nx || cy < 0 || cy >= ny || cz < 0 || cz >= nz) continue;
          for (const j of grid[(cz * ny + cy) * nx + cx]) {
            if (j === i) continue;
            const ddx = mx[i] - mx[j], ddy = my[i] - my[j], ddz = mz[i] - mz[j];
            const d2 = ddx * ddx + ddy * ddy + ddz * ddz;
            if (d2 > maxD2 || d2 >= bestD[NEIGHBOURS - 1]) continue;
            let k = NEIGHBOURS - 1;
            while (k > 0 && bestD[k - 1] > d2) {
              bestD[k] = bestD[k - 1];
              bestJ[k] = bestJ[k - 1];
              k--;
            }
            bestD[k] = d2;
            bestJ[k] = j;
          }
        }
    for (let k = 0; k < NEIGHBOURS; k++) {
      const j = bestJ[k];
      if (j < 0) continue;
      edges.add(Math.min(i, j) * 65536 + Math.max(i, j));
    }
  }
  const edgeA = new Int32Array(edges.size);
  const edgeB = new Int32Array(edges.size);
  let e = 0;
  edges.forEach((key) => {
    edgeA[e] = Math.floor(key / 65536);
    edgeB[e] = key % 65536;
    e++;
  });

  return { n, mx, my, mz, detail: Float32Array.from(ds), neuron, edgeA, edgeB };
}

let cachedModel: HeadModel | null = null;
function getModel(): HeadModel {
  if (!cachedModel) cachedModel = buildModel();
  return cachedModel;
}

function depthBand(z: number): number {
  const t = Math.min(0.999, Math.max(0, (z + 1) * 0.5));
  return Math.floor(t * DEPTH_BANDS);
}

function depthAlpha(band: number): number {
  const t = (band + 0.5) / DEPTH_BANDS;
  return 0.08 + 0.92 * t * t;
}

const buckets = (count: number): number[][] => Array.from({ length: count }, () => []);

interface HeadColours {
  line: string; // "r, g, b"
  dot: string;
}

function readColours(el: Element): HeadColours {
  const style = getComputedStyle(el);
  return {
    line: style.getPropertyValue('--head-line-rgb').trim() || '102, 126, 234',
    dot: style.getPropertyValue('--head-dot-rgb').trim() || '51, 51, 51',
  };
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  size: number,
  m: HeadModel,
  colours: HeadColours,
  yaw: number,
  pitch: number,
) {
  ctx.clearRect(0, 0, size, size);
  const scale = size * 0.34;
  const cx = size / 2;
  const cy = size / 2 - scale * 0.1;

  const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, scale * 1.6);
  halo.addColorStop(0, `rgba(${colours.line},0.14)`);
  halo.addColorStop(1, `rgba(${colours.line},0)`);
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, size, size);

  const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
  const cosP = Math.cos(pitch), sinP = Math.sin(pitch);
  const camera = 4;
  const px = new Float32Array(m.n);
  const py = new Float32Array(m.n);
  const pz = new Float32Array(m.n);
  for (let i = 0; i < m.n; i++) {
    const x1 = m.mx[i] * cosY + m.mz[i] * sinY;
    const z1 = -m.mx[i] * sinY + m.mz[i] * cosY;
    const y2 = m.my[i] * cosP - z1 * sinP;
    const z2 = m.my[i] * sinP + z1 * cosP;
    const k = camera / (camera - z2);
    px[i] = cx + x1 * k * scale;
    py[i] = cy - y2 * k * scale;
    pz[i] = z2;
  }

  const lineB = buckets(DEPTH_BANDS * DETAIL_BANDS);
  const dotB = buckets(DEPTH_BANDS);
  const neuronLineB = buckets(NEURON_RGB.length * DEPTH_BANDS);
  const neuronDotB = buckets(NEURON_RGB.length * DEPTH_BANDS);
  for (let i = 0; i < m.n; i++) {
    const depth = depthBand(pz[i]);
    const c = m.neuron[i];
    (c >= 0 ? neuronDotB[c * DEPTH_BANDS + depth] : dotB[depth]).push(i);
  }
  for (let e = 0; e < m.edgeA.length; e++) {
    const a = m.edgeA[e], b = m.edgeB[e];
    const depth = depthBand((pz[a] + pz[b]) * 0.5);
    const c = m.neuron[a] >= 0 ? m.neuron[a] : m.neuron[b];
    if (c >= 0) {
      neuronLineB[c * DEPTH_BANDS + depth].push(e);
    } else {
      const det = Math.floor(Math.min(0.999, (m.detail[a] + m.detail[b]) * 0.5) * DETAIL_BANDS);
      lineB[depth * DETAIL_BANDS + det].push(e);
    }
  }

  const strokeEdges = (list: number[], style: string, width: number) => {
    if (!list.length) return;
    ctx.beginPath();
    for (const e of list) {
      ctx.moveTo(px[m.edgeA[e]], py[m.edgeA[e]]);
      ctx.lineTo(px[m.edgeB[e]], py[m.edgeB[e]]);
    }
    ctx.strokeStyle = style;
    ctx.lineWidth = width;
    ctx.stroke();
  };
  const fillDots = (list: number[], style: string, r: number) => {
    if (!list.length) return;
    ctx.beginPath();
    for (const i of list) {
      ctx.moveTo(px[i] + r, py[i]);
      ctx.arc(px[i], py[i], r, 0, Math.PI * 2);
    }
    ctx.fillStyle = style;
    ctx.fill();
  };

  for (let depth = 0; depth < DEPTH_BANDS; depth++) {
    const da = depthAlpha(depth);
    for (let det = 0; det < DETAIL_BANDS; det++) {
      const alpha = da * (0.35 + (0.65 * (det + 0.5)) / DETAIL_BANDS);
      strokeEdges(lineB[depth * DETAIL_BANDS + det], `rgba(${colours.line},${alpha})`, 1);
    }
    fillDots(dotB[depth], `rgba(${colours.dot},${da * 0.95})`, 1.1);
  }

  for (let depth = 0; depth < DEPTH_BANDS; depth++) {
    const da = depthAlpha(depth);
    NEURON_RGB.forEach((rgb, c) => {
      const slot = c * DEPTH_BANDS + depth;
      strokeEdges(neuronLineB[slot], `rgba(${rgb},${da * 0.85})`, 1.3);
      fillDots(neuronDotB[slot], `rgba(${rgb},${da * 0.28})`, 4.5);
      fillDots(neuronDotB[slot], `rgba(${rgb},${da})`, 1.7);
    });
  }
}

// Ping-pong 0→1→0 over 2×period with an ease-in-out, like Compose's reversing tween.
function sway(t: number, periodMs: number): number {
  const phase = (t % (2 * periodMs)) / periodMs;
  const tri = phase <= 1 ? phase : 2 - phase;
  return 0.5 - 0.5 * Math.cos(Math.PI * tri);
}

interface WireframeHeadProps {
  size?: number;
}

const WireframeHead: React.FC<WireframeHeadProps> = ({ size = 320 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const model = getModel();
    let colours = readColours(canvas);
    const render = (t: number) =>
      drawFrame(ctx, size, model, colours, -1.62 + 0.8 * sway(t, 9000), -0.06 + 0.12 * sway(t, 6500));

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const themeObserver = new MutationObserver(() => {
      colours = readColours(canvas);
      if (reducedMotion) render(4500);
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    let frame = 0;
    if (reducedMotion) {
      render(4500);
    } else {
      frame = requestAnimationFrame(function loop(t) {
        render(t);
        frame = requestAnimationFrame(loop);
      });
    }
    return () => {
      cancelAnimationFrame(frame);
      themeObserver.disconnect();
    };
  }, [size]);

  return (
    <canvas
      ref={canvasRef}
      className="wireframe-head"
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
};

export default WireframeHead;

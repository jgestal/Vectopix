import type { Raster } from '../raster/raster';

/**
 * Exact pixel-grid tracing, for pixel art.
 *
 * Every pixel takes the nearest palette colour and each colour region is
 * outlined along the pixel edges, so the result is the image's own grid:
 * straight runs, square corners, and neighbouring colours sharing their
 * boundary exactly. vecline's mosaic tracer rounds these corners slightly,
 * which shows as notches where blocks meet.
 *
 * Shared edges alone still crack at fractional zoom: the renderer
 * anti-aliases each shape on its own and the background bleeds through the
 * join. So each colour also extends half a pixel under the colours painted
 * after it. Half a pixel never reaches past a one-pixel line, so what shows
 * is unchanged; the shapes must be painted in the order emitted.
 */

type Rgb = { r: number; g: number; b: number };

export interface PixelTraceColor {
  rgb: Rgb;
  hex: string;
}

/** Pixels below this alpha are empty: they belong to no colour. */
const OPAQUE_ALPHA = 128;

// Directions in screen space (y down): right, down, left, up
const DX = [1, 0, -1, 0];
const DY = [0, 1, 0, -1];

function nearestColour(r: number, g: number, b: number, colors: PixelTraceColor[]): number {
  let best = 0;
  let bestDist = Infinity;
  colors.forEach((c, i) => {
    const d = (c.rgb.r - r) ** 2 + (c.rgb.g - g) ** 2 + (c.rgb.b - b) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  });
  return best;
}

type Lattice = { x: number; y: number };

/**
 * Boundary edges of a mask, as outgoing directions per lattice vertex (up to
 * two, where two blocks touch diagonally). Edges run with the region on their
 * right: clockwise outer boundaries, counter-clockwise holes.
 */
function boundaryEdges(mask: Uint8Array, W: number, H: number): Map<number, number[]> {
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && mask[y * W + x] === 1;
  const edges = new Map<number, number[]>();
  const add = (x: number, y: number, dir: number) => {
    const k = y * (W + 1) + x;
    edges.set(k, [...(edges.get(k) ?? []), dir]);
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!inside(x, y)) continue;
      if (!inside(x, y - 1)) add(x, y, 0); // top, left → right
      if (!inside(x + 1, y)) add(x + 1, y, 1); // right, top → bottom
      if (!inside(x, y + 1)) add(x + 1, y + 1, 2); // bottom, right → left
      if (!inside(x - 1, y)) add(x, y + 1, 3); // left, bottom → top
    }
  return edges;
}

/**
 * The way on from a vertex reached heading `dir`. Where two blocks touch at a
 * corner, turn right: each block keeps its own loop instead of the two being
 * joined through a single point.
 */
function nextDirection(choices: number[], dir: number): number {
  const right = (dir + 1) % 4;
  if (choices.length > 1 && choices.includes(right)) return right;
  return choices.find((d) => d !== (dir + 2) % 4) ?? choices[0];
}

/** Walk one closed loop from `start`, using up the edges it takes; its corner vertices. */
function followLoop(edges: Map<number, number[]>, start: Lattice, firstDir: number, W: number): Lattice[] {
  const loop: Lattice[] = [];
  let { x, y } = start;
  let dir = firstDir;
  for (;;) {
    const prev = loop.at(-1);
    if (!prev || prev.x !== x || prev.y !== y) loop.push({ x, y });
    x += DX[dir];
    y += DY[dir];
    if (x === start.x && y === start.y) return loop;
    const choices = edges.get(y * (W + 1) + x)!;
    dir = nextDirection(choices, dir);
    choices.splice(choices.indexOf(dir), 1);
  }
}

/** Outline of a mask as closed loops of lattice points (corners only), which never cross. */
function outlineLoops(mask: Uint8Array, W: number, H: number): Lattice[][] {
  const edges = boundaryEdges(mask, W, H);
  const loops: Lattice[][] = [];
  for (const [key, dirs] of edges) {
    const start = { x: key % (W + 1), y: Math.floor(key / (W + 1)) };
    while (dirs.length) loops.push(dropCollinear(followLoop(edges, start, dirs.pop()!, W)));
  }
  return loops;
}

function dropCollinear(loop: Lattice[]): Lattice[] {
  const n = loop.length;
  return loop.filter((p, i) => {
    const a = loop[(i - 1 + n) % n];
    const b = loop[(i + 1) % n];
    return !((a.x === p.x && p.x === b.x) || (a.y === p.y && p.y === b.y));
  });
}

/** Path data for a loop traced on the half-pixel grid. */
function loopToPath(loop: Lattice[]): string {
  let d = `M${loop[0].x / 2} ${loop[0].y / 2}`;
  for (let i = 1; i < loop.length; i++) {
    const p = loop[i];
    const q = loop[i - 1];
    d += p.y === q.y ? `H${p.x / 2}` : `V${p.y / 2}`;
  }
  return d + 'Z';
}

/** Each pixel's palette index (-1 for empty pixels) and how many pixels each colour has. */
function labelPixels({ width: W, height: H, data }: Raster, colors: PixelTraceColor[]) {
  const labels = new Int32Array(W * H).fill(-1);
  const counts = new Array<number>(colors.length).fill(0);
  if (!colors.length) return { labels, counts };
  for (let i = 0; i < W * H; i++) {
    if (data[i * 4 + 3] < OPAQUE_ALPHA) continue;
    const c = nearestColour(data[i * 4], data[i * 4 + 1], data[i * 4 + 2], colors);
    labels[i] = c;
    counts[c]++;
  }
  return { labels, counts };
}

/**
 * The cells (on the half-pixel grid) colour number `k` in paint order covers:
 * its own, plus those of later colours touching them, which it reaches under.
 */
function underlapMask(k: number, rankAt: (x: number, y: number) => number, W2: number, H2: number, mask: Uint8Array): Uint8Array {
  const touches = (x: number, y: number) => {
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const [nx, ny] = [x + dx, y + dy];
        if (nx >= 0 && ny >= 0 && nx < W2 && ny < H2 && rankAt(nx, ny) === k) return true;
      }
    return false;
  };
  for (let y = 0; y < H2; y++)
    for (let x = 0; x < W2; x++) {
      const r = rankAt(x, y);
      mask[y * W2 + x] = r === k || (r > k && touches(x, y)) ? 1 : 0;
    }
  return mask;
}

export function tracePixelGrid(raster: Raster, colors: PixelTraceColor[]): { svg: string; shapes: number; regions: number } {
  const { width: W, height: H } = raster;
  const { labels, counts } = labelPixels(raster, colors);

  // Largest colour first: it is the one others most often sit inside
  const order = colors.map((_, i) => i).filter((i) => counts[i] > 0).sort((a, b) => counts[b] - counts[a]);
  const rank = new Int32Array(colors.length).fill(-1);
  order.forEach((c, i) => (rank[c] = i));

  // Work on the half-pixel grid: cell (x, y) is quarter (x & 1, y & 1) of pixel (x >> 1, y >> 1)
  const [W2, H2] = [W * 2, H * 2];
  const rankAt = (x: number, y: number) => {
    const label = labels[(y >> 1) * W + (x >> 1)];
    return label < 0 ? -1 : rank[label];
  };

  let regions = 0;
  const mask = new Uint8Array(W2 * H2);
  const paths = order.map((c, k) => {
    const loops = outlineLoops(underlapMask(k, rankAt, W2, H2, mask), W2, H2);
    regions += loops.length;
    return `<path fill-rule="evenodd" d="${loops.map(loopToPath).join('')}" fill="${colors[c].hex}"/>`;
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${paths.join('')}</svg>`;
  return { svg, shapes: paths.length, regions };
}

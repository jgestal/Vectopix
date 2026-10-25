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

/**
 * Outline of a mask as closed loops of lattice points. Edges run with the
 * region on their right (clockwise outer boundaries, counter-clockwise holes),
 * so the loops never cross and fill correctly with either fill rule.
 */
function outlineLoops(mask: Uint8Array, W: number, H: number): { x: number; y: number }[][] {
  const colour = 1;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : mask[y * W + x]);
  // Outgoing edges per lattice vertex: up to two (where two blocks touch diagonally)
  const out = new Map<number, number[]>();
  const key = (x: number, y: number) => y * (W + 1) + x;
  const addEdge = (x: number, y: number, dir: number) => {
    const k = key(x, y);
    const list = out.get(k);
    if (list) list.push(dir);
    else out.set(k, [dir]);
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (mask[y * W + x] !== colour) continue;
      if (at(x, y - 1) !== colour) addEdge(x, y, 0); // top, left → right
      if (at(x + 1, y) !== colour) addEdge(x + 1, y, 1); // right, top → bottom
      if (at(x, y + 1) !== colour) addEdge(x + 1, y + 1, 2); // bottom, right → left
      if (at(x - 1, y) !== colour) addEdge(x, y + 1, 3); // left, bottom → top
    }

  const loops: { x: number; y: number }[][] = [];
  for (const [startKey, dirs] of out) {
    while (dirs.length) {
      const loop: { x: number; y: number }[] = [];
      let x = startKey % (W + 1);
      let y = (startKey - x) / (W + 1);
      let dir = dirs.pop()!;
      const sx = x;
      const sy = y;
      for (;;) {
        // Keep only the corners: a vertex where the direction changes
        const prev = loop.length ? loop[loop.length - 1] : null;
        if (!prev || prev.x !== x || prev.y !== y) loop.push({ x, y });
        x += DX[dir];
        y += DY[dir];
        if (x === sx && y === sy) break;
        const next = out.get(key(x, y))!;
        // Where two blocks touch at a corner, turn right: each block keeps its
        // own loop instead of the two being joined through a single point
        const right = (dir + 1) % 4;
        const pick = next.length > 1 && next.includes(right) ? right : next.find((d) => d !== (dir + 2) % 4) ?? next[0];
        next.splice(next.indexOf(pick), 1);
        dir = pick;
      }
      loops.push(dropCollinear(loop));
    }
  }
  return loops;
}

function dropCollinear(loop: { x: number; y: number }[]): { x: number; y: number }[] {
  const n = loop.length;
  return loop.filter((p, i) => {
    const a = loop[(i - 1 + n) % n];
    const b = loop[(i + 1) % n];
    return !((a.x === p.x && p.x === b.x) || (a.y === p.y && p.y === b.y));
  });
}

/** Path data for a loop traced on the half-pixel grid. */
function loopToPath(loop: { x: number; y: number }[]): string {
  let d = `M${loop[0].x / 2} ${loop[0].y / 2}`;
  for (let i = 1; i < loop.length; i++) {
    const p = loop[i];
    const q = loop[i - 1];
    d += p.y === q.y ? `H${p.x / 2}` : `V${p.y / 2}`;
  }
  return d + 'Z';
}

export function tracePixelGrid(raster: Raster, colors: PixelTraceColor[]): { svg: string; shapes: number; regions: number } {
  const { width: W, height: H, data } = raster;
  const labels = new Int32Array(W * H).fill(-1);
  const counts = new Array(colors.length).fill(0);
  if (colors.length) {
    for (let i = 0; i < W * H; i++) {
      if (data[i * 4 + 3] < OPAQUE_ALPHA) continue;
      const c = nearestColour(data[i * 4], data[i * 4 + 1], data[i * 4 + 2], colors);
      labels[i] = c;
      counts[c]++;
    }
  }

  // Largest colour first: it is the one others most often sit inside
  const order = colors.map((_, i) => i).filter((i) => counts[i] > 0).sort((a, b) => counts[b] - counts[a]);
  const rank = new Int32Array(colors.length).fill(-1);
  order.forEach((c, i) => (rank[c] = i));

  // Work on the half-pixel grid: cell (x, y) is quarter (x & 1, y & 1) of pixel (x >> 1, y >> 1)
  const W2 = W * 2;
  const H2 = H * 2;
  const rankAt = (x: number, y: number) => {
    const label = labels[(y >> 1) * W + (x >> 1)];
    return label < 0 ? -1 : rank[label];
  };

  let regions = 0;
  const mask = new Uint8Array(W2 * H2);
  const paths = order.map((c, k) => {
    // The colour's own cells, plus the cells of later colours touching it
    for (let y = 0; y < H2; y++)
      for (let x = 0; x < W2; x++) {
        const r = rankAt(x, y);
        let inside = r === k;
        if (!inside && r > k) {
          for (let dy = -1; dy <= 1 && !inside; dy++)
            for (let dx = -1; dx <= 1 && !inside; dx++) {
              const nx = x + dx;
              const ny = y + dy;
              inside = nx >= 0 && ny >= 0 && nx < W2 && ny < H2 && rankAt(nx, ny) === k;
            }
        }
        mask[y * W2 + x] = inside ? 1 : 0;
      }
    const loops = outlineLoops(mask, W2, H2);
    regions += loops.length;
    return `<path fill-rule="evenodd" d="${loops.map(loopToPath).join('')}" fill="${colors[c].hex}"/>`;
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${paths.join('')}</svg>`;
  return { svg, shapes: paths.length, regions };
}

import { describe, expect, it } from 'vitest';
import { parsePathSegments } from '../utils/pathParser';
import { refinePathData, refineSvg } from './svgRefine';

/** A closed outline through `pts`, each edge drawn as a slightly wobbling cubic. */
function wobblyPolygon(pts: [number, number][], wobble = 0.6): string {
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i <= pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i % pts.length];
    const nx = -(by - ay);
    const ny = bx - ax;
    const l = Math.hypot(nx, ny);
    const ox = (nx / l) * wobble;
    const oy = (ny / l) * wobble;
    d += `C${ax + (bx - ax) / 3 + ox} ${ay + (by - ay) / 3 + oy} ${ax + (2 * (bx - ax)) / 3 - ox} ${ay + (2 * (by - ay)) / 3 - oy} ${bx} ${by}`;
  }
  return d + 'Z';
}

/** A circle as a polygon of many short chords, the way a tracer may draw it. */
function chordCircle(cx: number, cy: number, r: number, sides: number): string {
  const pts = Array.from({ length: sides }, (_, i) => [cx + r * Math.cos((2 * Math.PI * i) / sides), cy + r * Math.sin((2 * Math.PI * i) / sides)]);
  return `M${pts.map((p) => p.join(' ')).join('L')}Z`;
}

const kinds = (d: string) => parsePathSegments(d).map((s) => s.type).join('');

describe('refinePathData', () => {
  it('turns wobbling edges into straight lines with sharp corners', () => {
    const hexagon = Array.from({ length: 6 }, (_, i) => [200 + 120 * Math.cos((Math.PI / 3) * i), 200 + 120 * Math.sin((Math.PI / 3) * i)] as [number, number]);
    const d = refinePathData(wobblyPolygon(hexagon))!;
    expect(kinds(d)).toBe('MLLLLLZ');
    // Corners land on the true vertices
    const first = parsePathSegments(d)[0];
    expect(hexagon.some(([x, y]) => Math.hypot(x - first.x, y - first.y) < 1)).toBe(true);
  });

  it('turns a circle drawn as chords back into curves', () => {
    const d = refinePathData(chordCircle(100, 100, 40, 24))!;
    expect(kinds(d)).not.toContain('L');
    const ends = parsePathSegments(d).filter((s) => s.type !== 'Z');
    for (const s of ends) expect(Math.hypot(s.x - 100, s.y - 100)).toBeCloseTo(40, 0);
  });

  it('drops slivers of anti-aliasing fringe', () => {
    expect(refinePathData('M10 10h120v0.8h-120z')).toBeNull();
    expect(refinePathData('M10 10h120v0.8h-120zM10 40h50v50h-50z')).not.toBeNull();
  });
});

describe('refineSvg', () => {
  it('leaves the background rectangle and non-path elements untouched', () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h400v400H0z" fill="#fff"/><circle cx="5" cy="5" r="3" fill="red"/>' +
      `<path fill="#000" d="${chordCircle(200, 200, 50, 30)}"/></svg>`;
    const out = refineSvg(svg);
    expect(out).toContain('<path d="M0 0h400v400H0z" fill="#fff"/>');
    expect(out).toContain('<circle cx="5" cy="5" r="3" fill="red"/>');
    expect(out).not.toContain(chordCircle(200, 200, 50, 30));
  });

  it('removes a path that is nothing but fringe', () => {
    expect(refineSvg('<svg><path fill="#ccc" d="M10 10h120v0.8h-120z"/></svg>')).toBe('<svg></svg>');
  });
});

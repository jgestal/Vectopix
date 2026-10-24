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
  it('keeps a subpath as traced when the refit would change its shape', () => {
    // A 4 px blob from a 64 px logo: too small for the line and corner
    // detectors, whose refit strays several px from it
    const traced = 'M37 35l10 5l1 1l-2 1c-4.3 1.1-8.6 4.4-12.6 6.6c-1 0-.6.1-1.4-.6v-10z';
    expect(refinePathData(traced)).toBe(traced);
  });

  it('still straightens a long edge the tracer bowed by a couple of px', () => {
    // The crest's shield: its top edges bow 1.75 px; on a 200 px shape that is noise
    const traced =
      'M105.1 110.7c18.6-8.9 42.1-11.5 62.2-16.9c15-4 28.2-10 43.4-6c14 3.8 28.1 7.2 42 11c10.6 2.9 34.2 6.6 42.3 11.9c-.4 16.2-.5 31.7-2.1 47.6c-4.9 49.4-21.3 111.1-63.1 144.5c-6.6 5.2-22.8 19.4-31.1 18.9c-4.6-.3-23-14.4-27.5-17.9c-32.2-25.8-49.7-69.5-58.1-108.5c-5.9-27.9-7.4-55.7-8-84.6z';
    const refit = refinePathData(traced)!;
    expect(refit).not.toBe(traced);
    expect(parsePathSegments(refit).length).toBeLessThan(parsePathSegments(traced).length);
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

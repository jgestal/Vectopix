// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import {
  countShapes,
  deleteNode,
  extractInteractiveNodes,
  moveNode,
  parsePathSegments,
  parseSvgDocument,
  serializeParsedDoc,
  serializePathSegments,
  simplifySvgPaths,
  splitSegmentAtMidpoint,
} from './pathParser';

describe('parsePathSegments', () => {
  it('resolves relative and compact commands to absolute segments', () => {
    const segs = parsePathSegments('M10 10h5v5H10z');
    expect(segs).toEqual([
      { type: 'M', x: 10, y: 10 },
      { type: 'L', x: 15, y: 10 },
      { type: 'L', x: 15, y: 15 },
      { type: 'L', x: 10, y: 15 },
      { type: 'Z', x: 10, y: 10 },
    ]);
  });

  it('parses compressed numbers like .5.5 and implicit lineTo after M', () => {
    const segs = parsePathSegments('m1 1 .5.5 1-1');
    expect(segs.map((s) => [s.type, s.x, s.y])).toEqual([
      ['M', 1, 1],
      ['L', 1.5, 1.5],
      ['L', 2.5, 0.5],
    ]);
  });

  it('converts quadratic curves to equivalent cubics', () => {
    const [, c] = parsePathSegments('M0 0Q3 3 6 0');
    expect(c).toMatchObject({ type: 'C', cp1x: 2, cp1y: 2, cp2x: 4, cp2y: 2, x: 6, y: 0 });
  });

  it('converts arcs to cubics that pass through the arc', () => {
    // Half circle of radius 5 from (0,0) to (10,0), bulging upwards (y < 0)
    const segs = parsePathSegments('M0 0A5 5 0 0 1 10 0');
    expect(segs).toHaveLength(3);
    expect(segs[1]).toMatchObject({ type: 'C' });
    expect(segs[1].x).toBeCloseTo(5);
    expect(segs[1].y).toBeCloseTo(-5);
    expect(segs[2]).toMatchObject({ x: 10, y: 0 });
  });

  it('reads arc flags packed without separators', () => {
    const packed = parsePathSegments('M0 0a5 5 0 0110 0');
    const spaced = parsePathSegments('M0 0a5 5 0 0 1 10 0');
    expect(packed).toEqual(spaced);
  });

  it('reflects the previous quadratic control point for T', () => {
    const [, q, t] = parsePathSegments('M0 0Q5 5 10 0T20 0');
    expect(q).toMatchObject({ x: 10, y: 0 });
    // Reflected control point (15,-5) → cubic handles at 2/3 towards it
    expect(t.cp1x).toBeCloseTo(13.333);
    expect(t.cp1y).toBeCloseTo(-3.333);
  });
});

describe('serializePathSegments', () => {
  it('writes compact relative commands', () => {
    expect(serializePathSegments(parsePathSegments('M10 10L20 10L20 25L10.5 30Z'))).toBe('M10 10h10v15l-9.5 5z');
  });

  it('round-trips without accumulating rounding error', () => {
    const d = 'M0.333 0.333 L10.333 0.333 C10.666 5.111 5.111 10.666 0.333 10.333 Z';
    const again = parsePathSegments(serializePathSegments(parsePathSegments(d)));
    parsePathSegments(d).forEach((seg, i) => {
      expect(again[i].x).toBeCloseTo(seg.x, 2);
      expect(again[i].y).toBeCloseTo(seg.y, 2);
    });
  });
});

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
<defs><linearGradient id="g"><stop offset="0" stop-color="#f00"/></linearGradient></defs>
<rect width="20" height="20" fill="url(#g)"/>
<path d="M0 0h10v10H0z" fill="#123456"/>
<path d="M2 2A3 3 0 0 1 8 8" fill="none" stroke="#000"/>
<path d="M0 0L5 5 oops" fill="#000"/>
</svg>`;

describe('serializeParsedDoc', () => {
  it('keeps defs, primitives and untouched paths exactly as they were', () => {
    const doc = parseSvgDocument(SVG);
    const moved = moveNode(doc, { pathIndex: 0, segmentIndex: 1, nodeType: 'anchor' }, 12, 0);
    const out = serializeParsedDoc(moved);

    expect(out).toContain('<linearGradient id="g">');
    expect(out).toContain('<rect width="20" height="20" fill="url(#g)"');
    expect(out).toContain('d="M2 2A3 3 0 0 1 8 8"');
    expect(out).toContain('d="M0 0h12l-2 10h-10z"');
  });

  it('makes arcs editable but never touches paths it could not fully parse', () => {
    const doc = parseSvgDocument(SVG);
    expect(doc.paths.map((p) => p.editable)).toEqual([true, true, false]);
    const nodes = extractInteractiveNodes(doc.paths, null);
    expect(nodes.some((n) => n.pathIndex === 2)).toBe(false);
  });
});

describe('node editing', () => {
  const curveDoc = () =>
    parseSvgDocument('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0 C1 1 2 1 3 0 C4 -1 5 -1 6 0"/></svg>');

  it('moves both handles attached to a dragged anchor', () => {
    const moved = moveNode(curveDoc(), { pathIndex: 0, segmentIndex: 1, nodeType: 'anchor' }, 3, 2);
    const [, first, second] = moved.paths[0].segments;
    expect(first).toMatchObject({ x: 3, y: 2, cp2x: 2, cp2y: 3 });
    expect(second).toMatchObject({ cp1x: 4, cp1y: 1 });
  });

  it('promotes the next anchor when deleting the start of a subpath', () => {
    const doc = parseSvgDocument('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0L5 0L5 5L0 5Z"/></svg>');
    const result = deleteNode(doc, 0, 0);
    expect(result?.paths[0].segments[0]).toEqual({ type: 'M', x: 5, y: 0 });
    expect(result?.paths[0].segments).toHaveLength(4);
  });

  it('refuses to leave a path with fewer than two anchors', () => {
    const doc = parseSvgDocument('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0L5 0"/></svg>');
    expect(deleteNode(doc, 0, 1)).toBeNull();
  });

  it('splits a cubic at its midpoint without changing its shape endpoints', () => {
    const { newDoc } = splitSegmentAtMidpoint(curveDoc(), 0, 1);
    const segs = newDoc.paths[0].segments;
    expect(segs).toHaveLength(4);
    expect(segs[1]).toMatchObject({ type: 'C', x: 1.5, y: 0.75 });
    expect(segs[2]).toMatchObject({ type: 'C', x: 3, y: 0 });
  });

  it('removes collinear stair-step nodes when simplifying', () => {
    const doc = parseSvgDocument(
      '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0L10 0L20 0L30 0L30 10Z"/></svg>'
    );
    const { removedCount } = simplifySvgPaths(doc, 1.2);
    expect(removedCount).toBeGreaterThan(0);
  });
});

describe('countShapes', () => {
  it('counts paths and primitives, not empty paths', () => {
    const svg =
      '<svg><path d="M0 0h10v10z" fill="#000"/><circle cx="5" cy="5" r="2" fill="#f00"/><rect x="0" y="0" width="2" height="2"/><path d="" fill="#00f"/></svg>';
    expect(countShapes(svg)).toBe(3);
  });
});

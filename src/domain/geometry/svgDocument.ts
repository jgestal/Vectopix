import { parsePathData, serializePathSegments, type PathSegment } from './pathData';
import type { SvgDom } from './svgDom';

/** An SVG as an editable document: its paths as segments, everything else kept as is. */

export interface ParsedPath {
  id: string;
  originalD: string;
  attributes: Record<string, string>;
  segments: PathSegment[];
  /** False when the path data couldn't be parsed; such paths are never rewritten. */
  editable: boolean;
}

export interface ParsedSvgDoc {
  /** The SVG markup this document was parsed from. */
  source: string;
  svgAttributes: Record<string, string>;
  paths: ParsedPath[];
  width: number;
  height: number;
  viewBox: string;
}

// Segment arrays exactly as parsed. Every edit creates a new array, so a path
// whose segments are still in here is untouched and keeps its original `d`.
const pristineSegments = new WeakMap<PathSegment[], true>();

/** Parse an SVG into editable paths. */
export function parseSvgDocument(svgString: string, dom: SvgDom): ParsedSvgDoc {
  const tree = dom.parse(svgString);
  const root = tree.root();
  const svgAttributes = Object.fromEntries(root?.attributes() ?? []);
  const width = parseFloat(root?.getAttribute('width') || '400');
  const height = parseFloat(root?.getAttribute('height') || '400');
  const viewBox = root?.getAttribute('viewBox') || `0 0 ${width} ${height}`;

  const paths: ParsedPath[] = tree.select('path').map((pathEl, idx) => {
    const rawD = pathEl.getAttribute('d') || '';
    const { segments, complete } = parsePathData(rawD);
    pristineSegments.set(segments, true);
    return {
      id: pathEl.getAttribute('id') || `path_${idx}`,
      originalD: rawD,
      attributes: Object.fromEntries(pathEl.attributes().filter(([name]) => name !== 'd')),
      segments,
      // A path the parser could only partly read is left as is rather than mangled
      editable: complete && segments.length > 0,
    };
  });

  return { source: svgString, svgAttributes, paths, width, height, viewBox };
}

/**
 * Serialize an edited document back to SVG. Only the `d` of edited paths is
 * rewritten: everything else (defs, gradients, groups, primitives, attributes)
 * is preserved exactly as in the source.
 */
export function serializeParsedDoc(doc: ParsedSvgDoc, dom: SvgDom): string {
  const tree = dom.parse(doc.source);
  const pathElements = tree.select('path');
  doc.paths.forEach((p, i) => {
    const el = pathElements[i];
    if (!el || !p.editable || pristineSegments.has(p.segments)) return;
    el.setAttribute('d', serializePathSegments(p.segments));
  });
  return tree.serialize();
}

/** A copy of `doc` with one path's segments replaced. */
export function updateSegments(
  doc: ParsedSvgDoc,
  pathIndex: number,
  update: (segments: PathSegment[]) => PathSegment[]
): ParsedSvgDoc {
  const paths = [...doc.paths];
  const target = paths[pathIndex];
  paths[pathIndex] = { ...target, segments: update([...target.segments]) };
  return { ...doc, paths };
}

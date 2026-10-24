type Polyline = { x: number; y: number }[];

function parseHexColor(hex: string): { r: number; g: number; b: number } {
  let clean = hex.replace('#', '');
  if (clean.length === 3) clean = clean.split('').map((c) => c + c).join('');
  return {
    r: parseInt(clean.slice(0, 2), 16) || 0,
    g: parseInt(clean.slice(2, 4), 16) || 0,
    b: parseInt(clean.slice(4, 6), 16) || 0,
  };
}

/**
 * Centerline polylines as a DXF R12 document (Y axis flipped to CAD convention)
 */
export function centerlineToDxf(polylines: Polyline[], height: number): string {
  const parts = ['0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n'];
  for (const poly of polylines) {
    if (poly.length < 2) continue;
    parts.push('0\nPOLYLINE\n8\nCENTERLINE\n66\n1\n70\n0\n');
    for (const pt of poly) {
      parts.push(`0\nVERTEX\n8\nCENTERLINE\n10\n${pt.x.toFixed(2)}\n20\n${(height - pt.y).toFixed(2)}\n30\n0.0\n`);
    }
    parts.push('0\nSEQEND\n');
  }
  parts.push('0\nENDSEC\n0\nEOF\n');
  return parts.join('');
}

/**
 * PostScript stroke commands shared by the EPS and PDF writers
 */
function strokeCommands(
  polylines: Polyline[],
  height: number,
  ops: { begin: string; move: string; line: string; stroke: string }
): string {
  const parts: string[] = [];
  for (const poly of polylines) {
    if (poly.length < 2) continue;
    parts.push(`${ops.begin}${poly[0].x.toFixed(2)} ${(height - poly[0].y).toFixed(2)} ${ops.move}\n`);
    for (let i = 1; i < poly.length; i++) {
      parts.push(`${poly[i].x.toFixed(2)} ${(height - poly[i].y).toFixed(2)} ${ops.line}\n`);
    }
    parts.push(`${ops.stroke}\n`);
  }
  return parts.join('');
}

/**
 * Centerline polylines as an EPS 3.0 document
 */
export function centerlineToEps(
  polylines: Polyline[],
  width: number,
  height: number,
  strokeWidth = 2,
  strokeColor = '#000000'
): string {
  const { r, g, b } = parseHexColor(strokeColor);
  return (
    '%!PS-Adobe-3.0 EPSF-3.0\n' +
    `%%BoundingBox: 0 0 ${Math.ceil(width)} ${Math.ceil(height)}\n` +
    '%%Creator: Vectopix\n%%EndComments\n' +
    `${strokeWidth} setlinewidth\n1 setlinecap\n1 setlinejoin\n` +
    `${(r / 255).toFixed(3)} ${(g / 255).toFixed(3)} ${(b / 255).toFixed(3)} setrgbcolor\n` +
    strokeCommands(polylines, height, { begin: 'newpath ', move: 'moveto', line: 'lineto', stroke: 'stroke' }) +
    'showpage\n%%EOF\n'
  );
}

/**
 * Centerline polylines as a minimal, valid PDF 1.4 document
 */
export function centerlineToPdf(
  polylines: Polyline[],
  width: number,
  height: number,
  strokeWidth = 2,
  strokeColor = '#000000'
): Uint8Array {
  const { r, g, b } = parseHexColor(strokeColor);
  const encoder = new TextEncoder();
  const stream =
    `${strokeWidth} w\n1 J\n1 j\n${(r / 255).toFixed(3)} ${(g / 255).toFixed(3)} ${(b / 255).toFixed(3)} RG\n` +
    strokeCommands(polylines, height, { begin: '', move: 'm', line: 'l', stroke: 'S' });

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Contents 4 0 R >>`,
    `<< /Length ${encoder.encode(stream).length} >>\nstream\n${stream}endstream`,
  ];

  let body = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(encoder.encode(body).length);
    body += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });

  const xrefOffset = encoder.encode(body).length;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) xref += `${off.toString().padStart(10, '0')} 00000 n \n`;
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return encoder.encode(body + xref);
}

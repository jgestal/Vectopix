import type { SampleImageItem } from '../types/vector';

export function generateSampleDataUrl(id: string): string {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  if (id === 'tech-logo') {
    canvas.width = 400;
    canvas.height = 400;

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 400, 400);

    // Modern Tech Logo: Hexagon with gradient shapes
    ctx.save();
    ctx.translate(200, 200);

    // Outer hexagon ring
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      const x = 140 * Math.cos(angle);
      const y = 140 * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = '#1e1b4b';
    ctx.fill();

    // Geometric facet 1
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -110);
    ctx.lineTo(95, -55);
    ctx.closePath();
    ctx.fillStyle = '#6366f1';
    ctx.fill();

    // Geometric facet 2
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(95, -55);
    ctx.lineTo(95, 55);
    ctx.closePath();
    ctx.fillStyle = '#818cf8';
    ctx.fill();

    // Geometric facet 3
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(95, 55);
    ctx.lineTo(0, 110);
    ctx.closePath();
    ctx.fillStyle = '#4f46e5';
    ctx.fill();

    // Geometric facet 4
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 110);
    ctx.lineTo(-95, 55);
    ctx.closePath();
    ctx.fillStyle = '#06b6d4';
    ctx.fill();

    // Geometric facet 5
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-95, 55);
    ctx.lineTo(-95, -55);
    ctx.closePath();
    ctx.fillStyle = '#0ea5e9';
    ctx.fill();

    // Geometric facet 6
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-95, -55);
    ctx.lineTo(0, -110);
    ctx.closePath();
    ctx.fillStyle = '#38bdf8';
    ctx.fill();

    // Center jewel circle
    ctx.beginPath();
    ctx.arc(0, 0, 36, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, Math.PI * 2);
    ctx.fillStyle = '#ec4899';
    ctx.fill();

    ctx.restore();
  } else if (id === 'badge-crest') {
    canvas.width = 400;
    canvas.height = 400;

    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, 400, 400);

    ctx.save();
    ctx.translate(200, 200);

    // Shield outline
    ctx.beginPath();
    ctx.moveTo(0, -130);
    ctx.lineTo(110, -100);
    ctx.bezierCurveTo(110, 30, 70, 110, 0, 140);
    ctx.bezierCurveTo(-70, 110, -110, 30, -110, -100);
    ctx.closePath();
    ctx.fillStyle = '#0f172a';
    ctx.fill();

    // Shield inner
    ctx.beginPath();
    ctx.moveTo(0, -115);
    ctx.lineTo(95, -90);
    ctx.bezierCurveTo(95, 20, 60, 95, 0, 122);
    ctx.bezierCurveTo(-60, 95, -95, 20, -95, -90);
    ctx.closePath();
    ctx.fillStyle = '#f59e0b';
    ctx.fill();

    // Star in center
    ctx.beginPath();
    const spikes = 5;
    const outerRadius = 45;
    const innerRadius = 20;
    let rot = (Math.PI / 2) * 3;
    const step = Math.PI / spikes;

    ctx.moveTo(0, -outerRadius);
    for (let i = 0; i < spikes; i++) {
      let x = Math.cos(rot) * outerRadius;
      let y = Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y);
      rot += step;

      x = Math.cos(rot) * innerRadius;
      y = Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y);
      rot += step;
    }
    ctx.lineTo(0, -outerRadius);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.restore();
  } else if (id === 'hand-sketch') {
    canvas.width = 400;
    canvas.height = 300;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 400, 300);

    // Smooth organic signature / calligraphy
    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(70, 160);
    ctx.bezierCurveTo(100, 60, 120, 50, 140, 170);
    ctx.bezierCurveTo(160, 260, 180, 110, 220, 120);
    ctx.bezierCurveTo(250, 130, 270, 160, 310, 110);
    ctx.bezierCurveTo(330, 90, 340, 130, 350, 190);
    ctx.stroke();

    // Underline swoosh
    ctx.beginPath();
    ctx.moveTo(90, 210);
    ctx.bezierCurveTo(180, 240, 280, 210, 330, 195);
    ctx.lineWidth = 6;
    ctx.stroke();
  } else if (id === 'pixel-heart') {
    canvas.width = 160;
    canvas.height = 160;

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 160, 160);

    const pixelGrid = [
      '  XXXX   XXXX  ',
      ' XRRRRX XRRRRX ',
      'XRRRRRRXRRRRRRX',
      'XRRRRRRRRRRRRRX',
      'XRRRRRRRRRRRRRX',
      ' XRRRRRRRRRRRX ',
      '  XRRRRRRRRRX  ',
      '   XRRRRRRRX   ',
      '    XRRRRRX    ',
      '     XRRRX     ',
      '      XRX      ',
      '       X       ',
    ];

    const cellSize = 10;
    const startX = 8;
    const startY = 20;

    for (let r = 0; r < pixelGrid.length; r++) {
      const row = pixelGrid[r];
      for (let c = 0; c < row.length; c++) {
        const char = row[c];
        if (char === 'X') {
          ctx.fillStyle = '#1c1917';
          ctx.fillRect(startX + c * cellSize, startY + r * cellSize, cellSize, cellSize);
        } else if (char === 'R') {
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(startX + c * cellSize, startY + r * cellSize, cellSize, cellSize);
        }
      }
    }
  }

  return canvas.toDataURL('image/png');
}

export const SAMPLE_IMAGES: SampleImageItem[] = [
  {
    id: 'tech-logo',
    title: 'Logo Tecnológico Geométrico',
    category: 'Logotipos',
    description: 'Bordes limpios y polígonos con anti-aliasing nítido.',
    url: '',
    preset: 'logo',
  },
  {
    id: 'badge-crest',
    title: 'Emblema Heráldico Vintage',
    category: 'Insignias',
    description: 'Curvas continuas Bézier y formas cerradas concéntricas.',
    url: '',
    preset: 'flat-art',
  },
  {
    id: 'hand-sketch',
    title: 'Firma / Trazo Caligráfico',
    category: 'Bocetos',
    description: 'Trazo orgánico monocromo para prueba de contraste.',
    url: '',
    preset: 'sketch',
  },
  {
    id: 'pixel-heart',
    title: 'Corazón Pixel Art 8-bit',
    category: 'Pixel Art',
    description: 'Matriz ortogonal perfecta para modo Pixel Art bit-exact.',
    url: '',
    preset: 'pixel-art',
  },
];

import { describe, expect, it } from 'vitest';
import { removeOuterBackground, snapToCanvasEdge } from './background';

const svg = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">${body}</svg>`;
const WHITE = { r: 255, g: 255, b: 255 };

describe('removeOuterBackground', () => {
  it('removes the background region and the hole the subject sits in, keeping islands inside the subject', () => {
    const out = removeOuterBackground(
      svg(
        // White: the image area with a hole for the ring, plus the island inside the ring
        '<path fill-rule="evenodd" d="M0 0h100v100h-100zM20 20v60h60v-60zM40 40h20v20h-20z" fill="#fff"/>' +
          '<path fill-rule="evenodd" d="M20 20h60v60h-60zM40 40v20h20v-20z" fill="#000"/>'
      ),
      WHITE,
      100,
      100
    );
    const white = out.match(/<path[^>]*fill="#fff"\/>/)![0];
    expect(white).toContain('d="M40 40h20v20h-20z"');
    expect(out).toContain('d="M20 20h60v60h-60zM40 40v20h20v-20z" fill="#000"');
  });

  it('removes a backing rectangle and leaves other colours alone', () => {
    const out = removeOuterBackground(svg('<rect x="0" y="0" width="100" height="100" fill="#fefefe"/><circle cx="50" cy="50" r="20" fill="#f00"/>'), WHITE, 100, 100);
    expect(out).toBe(svg('<circle cx="50" cy="50" r="20" fill="#f00"/>'));
  });

  it('keeps background-coloured shapes that do not reach the border', () => {
    const input = svg('<path d="M30 30h40v40h-40z" fill="#000"/><path d="M45 45h10v10h-10z" fill="rgb(255,255,255)"/>');
    expect(removeOuterBackground(input, WHITE, 100, 100)).toBe(input);
  });
});

describe('snapToCanvasEdge', () => {
  it('moves points within half a pixel of the edge onto it and leaves the rest', () => {
    const out = snapToCanvasEdge(svg('<path d="M.5.5h99v99h-99zM10 10h20v20h-20z" fill="#fff"/>'), 100, 100);
    expect(out).toContain('d="M0 0h100v100h-100zm10 10h20v20h-20z"');
  });

  it('leaves paths away from the edge byte for byte', () => {
    const input = svg('<path d="M10 10L30 10L30 30z" fill="#000"/>');
    expect(snapToCanvasEdge(input, 100, 100)).toBe(input);
  });
});

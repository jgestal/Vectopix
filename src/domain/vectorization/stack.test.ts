import { describe, expect, it } from 'vitest';
import { stackSvg } from './stack';

const svg = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">${body}</svg>`;
const fills = (out: string) => [...out.matchAll(/fill="([^"]*)"/g)].map((m) => m[1]);

describe('stackSvg', () => {
  it('drops a hole that another shape fills and paints the filler on top', () => {
    // A frame with a square hole, drawn after the square that fills it
    const out = stackSvg(
      svg(
        '<path fill-rule="evenodd" d="M40 40h20v20h-20z" fill="#f00"/>' +
          '<path fill-rule="evenodd" d="M10 10h80v80h-80zM40 40v20h20v-20z" fill="#00f"/>'
      )
    );
    expect(fills(out)).toEqual(['#00f', '#f00']);
    const frame = out.match(/<path[^>]*fill="#00f"\/>/)![0];
    expect(frame.match(/[Mm]/g)).toHaveLength(1);
  });

  it('keeps a hole nothing fills (a real opening)', () => {
    const input = svg('<path fill-rule="evenodd" d="M10 10h80v80h-80zM40 40v20h20v-20z" fill="#00f"/><path d="M0 0h5v5h-5z" fill="#f00"/>');
    expect(stackSvg(input)).toBe(input);
  });

  it('keeps a hole that is only partly filled', () => {
    const out = stackSvg(
      svg('<path fill-rule="evenodd" d="M10 10h80v80h-80zM30 30v40h40v-40z" fill="#00f"/><path d="M30 30h20v40h-20z" fill="#f00"/>')
    );
    expect(out.match(/<path[^>]*fill="#00f"\/>/)![0].match(/[Mm]/g)).toHaveLength(2);
  });

  it('never lifts an enclosing backing shape above what it encloses', () => {
    // The backing rectangle also covers the frame's hole, but it must stay below
    const out = stackSvg(
      svg(
        '<path d="M0 0h100v100h-100z" fill="#fff"/>' +
          '<path fill-rule="evenodd" d="M10 10h80v80h-80zM40 40v20h20v-20z" fill="#00f"/>' +
          '<path d="M40 40h20v20h-20z" fill="#f00"/>'
      )
    );
    expect(fills(out)).toEqual(['#fff', '#00f', '#f00']);
  });
});

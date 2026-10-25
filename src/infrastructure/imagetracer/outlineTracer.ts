import ImageTracer from 'imagetracerjs';
import type { OutlineTracer } from '../../application/ports';

/** Strategy: ImageTracerJS, the alternative engine (picks its own palette). */
export const imageTracerOutlineTracer: OutlineTracer = {
  stage: 'progress.imagetracer',
  trace(raster, palette, options) {
    const svg = ImageTracer.imagedataToSVG(raster as unknown as ImageData, {
      numberofcolors: palette.length || options.colors,
      scale: 1,
      blurradius: options.blurRadius ?? 0,
      blurdelta: 20,
      pathomit: options.minArea,
      linefilter: true,
      corsenabled: false,
    });
    const paths = (svg.match(/<path/g) || []).length;
    return { svg, shapes: paths, regions: paths };
  },
};

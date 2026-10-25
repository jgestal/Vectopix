import ImageTracer from 'imagetracerjs';
import type { OutlineTracer } from '../../application/ports';

/** Strategy: ImageTracerJS, the alternative engine (picks its own palette). */
export const imageTracerOutlineTracer: OutlineTracer = {
  stage: 'progress.imagetracer',
  trace(raster, palette, options) {
    const svg = ImageTracer.imagedataToSVG(raster as unknown as ImageData, {
      numberofcolors: palette.length || options.colors,
      // In automatic mode the detected colours are imposed, as with vecline:
      // ImageTracer's own sampling can miss a thin colour (an outline) entirely
      ...(options.autoColors && palette.length ? { pal: palette.map(({ rgb }) => ({ ...rgb, a: 255 })) } : {}),
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

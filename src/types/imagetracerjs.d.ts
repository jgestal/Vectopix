declare module 'imagetracerjs' {
  const ImageTracer: {
    imagedataToSVG: (
      imageData: ImageData,
      options?: Record<string, unknown>
    ) => string;
    imageToSVG: (
      url: string,
      callback: (svgString: string) => void,
      options?: Record<string, unknown>
    ) => void;
    [key: string]: unknown;
  };
  export default ImageTracer;
}

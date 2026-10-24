/** Hard limit on the file itself; huge images are also downscaled after decoding. */
const MAX_FILE_BYTES = 50 * 1024 * 1024;

/**
 * Read an image file as a data URL, rejecting non-images and oversized files
 */
export function readImageFile(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    return Promise.reject(new Error('Selecciona un archivo de imagen válido (PNG, JPG, WebP, BMP)'));
  }
  if (file.size > MAX_FILE_BYTES) {
    return Promise.reject(new Error('La imagen supera el límite de 50 MB'));
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}

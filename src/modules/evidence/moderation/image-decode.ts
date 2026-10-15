import * as jpeg from 'jpeg-js';
import { PNG } from 'pngjs';

export type RgbImage = { data: Uint8Array; width: number; height: number };

export class UnsupportedImageError extends Error {}

function isJpeg(image: Buffer) {
  return image.length > 3 && image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff;
}

function isPng(image: Buffer) {
  return image.length > 8 && image.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
}

/** Decodifica JPG o PNG a RGB (sin canal alfa), el formato que espera el modelo. */
export function decodeRgb(image: Buffer): RgbImage {
  if (isJpeg(image)) {
    const raw = jpeg.decode(image, { useTArray: true, formatAsRGBA: false, maxMemoryUsageInMB: 512 });
    return { data: raw.data, width: raw.width, height: raw.height };
  }
  if (isPng(image)) {
    const png = PNG.sync.read(image);
    const rgb = new Uint8Array(png.width * png.height * 3);
    for (let i = 0, j = 0; i < png.data.length; i += 4, j += 3) {
      rgb[j] = png.data[i];
      rgb[j + 1] = png.data[i + 1];
      rgb[j + 2] = png.data[i + 2];
    }
    return { data: rgb, width: png.width, height: png.height };
  }
  throw new UnsupportedImageError('Formato de imagen no soportado: solo JPG o PNG');
}

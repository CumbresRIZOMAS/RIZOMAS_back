// Proceso hijo que decodifica la foto y corre NSFWJS. Se lanza con la primera
// foto y se cierra al quedar inactivo: así el modelo (~170 MB con TensorFlow.js)
// y los búferes de decodificar fotos grandes solo ocupan memoria mientras hay
// fotos por moderar; al terminar el proceso el sistema la recupera completa.
// Es JavaScript plano para lanzarlo igual desde dist/ (producción) y src/ (pruebas).
const jpeg = require('jpeg-js');
const { PNG } = require('pngjs');

const MODEL_SIZE = 224;

function isJpeg(image) {
  return image.length > 3 && image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff;
}

function isPng(image) {
  return image.length > 8 && image.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
}

/** Decodifica JPG o PNG a RGB (sin canal alfa). */
function decodeRgb(image) {
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
  throw new Error('Formato de imagen no soportado: solo JPG o PNG');
}

/**
 * Reduce a size×size promediando bloques (sin aliasing). El modelo trabaja a
 * 224×224: reducirla antes evita tensores de la foto completa.
 */
function resizeRgb(image, size = MODEL_SIZE) {
  const out = new Uint8Array(size * size * 3);
  for (let y = 0; y < size; y++) {
    const y0 = Math.floor((y * image.height) / size);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * image.height) / size));
    for (let x = 0; x < size; x++) {
      const x0 = Math.floor((x * image.width) / size);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * image.width) / size));
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const s = (sy * image.width + sx) * 3;
          r += image.data[s];
          g += image.data[s + 1];
          b += image.data[s + 2];
        }
      }
      const n = (y1 - y0) * (x1 - x0);
      const o = (y * size + x) * 3;
      out[o] = r / n;
      out[o + 1] = g / n;
      out[o + 2] = b / n;
    }
  }
  return { data: out, width: size, height: size };
}

module.exports = { decodeRgb, resizeRgb };

if (require.main === module) {
  const tf = require('@tensorflow/tfjs');
  const nsfwjs = require('nsfwjs');
  let model;

  process.on('message', async ({ id, image }) => {
    try {
      const small = resizeRgb(decodeRgb(Buffer.from(image)));
      model ??= await nsfwjs.load('MobileNetV2');
      const tensor = tf.tensor3d(small.data, [small.height, small.width, 3], 'int32');
      try {
        process.send({ id, predictions: await model.classify(tensor) });
      } finally {
        tensor.dispose();
      }
    } catch (error) {
      process.send({ id, error: error instanceof Error ? error.message : String(error) });
    }
  });
}

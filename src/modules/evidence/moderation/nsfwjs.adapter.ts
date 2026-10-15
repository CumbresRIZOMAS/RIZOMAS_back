import { Injectable } from '@nestjs/common';
import type { NSFWJS } from 'nsfwjs';
import { decodeRgb } from './image-decode';
import { ImageModerationAdapter, ModerationResult } from './moderation.port';

/**
 * Motor principal: NSFWJS (MobileNetV2 incluido en el paquete) corriendo
 * localmente con TensorFlow.js, sin enviar la foto a terceros.
 */
@Injectable()
export class NsfwjsAdapter implements ImageModerationAdapter {
  readonly name = 'NSFWJS';
  private model?: Promise<NSFWJS>;

  isEnabled() {
    return true;
  }

  async classify(image: Buffer): Promise<ModerationResult> {
    const [tf, model] = await Promise.all([import('@tensorflow/tfjs'), this.load()]);
    const { data, width, height } = decodeRgb(image);
    const tensor = tf.tensor3d(data, [height, width, 3], 'int32');
    try {
      const predictions = await model.classify(tensor);
      const labels = Object.fromEntries(predictions.map((p) => [p.className, p.probability]));
      // Porn y Hentai cuentan completo; Sexy a la mitad (puede ser ropa de trabajo, playa...).
      const score = Math.min(1, (labels.Porn ?? 0) + (labels.Hentai ?? 0) + 0.5 * (labels.Sexy ?? 0));
      return { score, labels };
    } finally {
      tensor.dispose();
    }
  }

  private load() {
    // Se carga una sola vez y solo cuando llega la primera foto.
    this.model ??= import('nsfwjs').then((nsfwjs) => nsfwjs.load('MobileNetV2'));
    return this.model;
  }
}

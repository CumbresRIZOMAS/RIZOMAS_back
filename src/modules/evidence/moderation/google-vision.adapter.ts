import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ImageModerationAdapter, ModerationResult } from './moderation.port';

const LIKELIHOOD: Record<string, number> = {
  UNKNOWN: 0,
  VERY_UNLIKELY: 0,
  UNLIKELY: 0.25,
  POSSIBLE: 0.5,
  LIKELY: 0.75,
  VERY_LIKELY: 1,
};

/** Verificación secundaria opcional: Google Cloud Vision SafeSearch. Requiere GOOGLE_VISION_API_KEY. */
@Injectable()
export class GoogleVisionAdapter implements ImageModerationAdapter {
  readonly name = 'GOOGLE_VISION';

  constructor(private readonly config: ConfigService) {}

  isEnabled() {
    return this.apiKey() !== null;
  }

  async classify(image: Buffer): Promise<ModerationResult> {
    const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${this.apiKey()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{ image: { content: image.toString('base64') }, features: [{ type: 'SAFE_SEARCH_DETECTION' }] }],
      }),
    });
    if (!response.ok) throw new Error(`Google Vision respondió ${response.status}`);
    const body = (await response.json()) as { responses?: { safeSearchAnnotation?: Record<string, string> }[] };
    const annotation = body.responses?.[0]?.safeSearchAnnotation;
    if (!annotation) throw new Error('Google Vision no devolvió SafeSearch');
    const labels = Object.fromEntries(Object.entries(annotation).map(([k, v]) => [k, LIKELIHOOD[v] ?? 0]));
    const score = Math.max(labels.adult ?? 0, 0.8 * (labels.racy ?? 0), labels.violence ?? 0);
    return { score, labels };
  }

  private apiKey(): string | null {
    const key = this.config.get<string>('GOOGLE_VISION_API_KEY')?.trim();
    return key && !key.startsWith('replace-with-') ? key : null;
  }
}

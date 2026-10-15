/** Resultado de un motor: probabilidad 0-1 de contenido inapropiado y el detalle por categoría. */
export type ModerationResult = { score: number; labels: Record<string, number> };

/**
 * Puerto (arquitectura hexagonal) para motores de moderación de imágenes. El
 * servicio de evidencias nunca depende de un proveedor concreto.
 */
export interface ImageModerationAdapter {
  readonly name: string;
  /** false si falta configuración (p. ej. sin API key): el servicio lo omite. */
  isEnabled(): boolean;
  classify(image: Buffer): Promise<ModerationResult>;
}

export const PRIMARY_MODERATION = Symbol('PRIMARY_MODERATION');
export const SECONDARY_MODERATION = Symbol('SECONDARY_MODERATION');

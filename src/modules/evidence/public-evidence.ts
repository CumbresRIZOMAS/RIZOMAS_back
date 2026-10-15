/**
 * Campos de una evidencia que pueden salir en contenido público (RF-18).
 * Nunca la geolocalización exacta (ASR-15), la clave del objeto en R2 ni
 * los datos de moderación o de quién la revisó.
 */
export const PUBLIC_EVIDENCE_SELECT = {
  id: true,
  url: true,
  capturedAt: true,
} as const;

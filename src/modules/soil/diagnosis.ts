/**
 * Lógica pura del diagnóstico de suelo (RF-11 / RF-12), sin acceso a la base.
 */

export type DiagnosisStatus = 'BAJO' | 'OPTIMO' | 'ALTO' | 'SIN_REFERENCIA';

export type ReferenceRange = {
  min: number | null;
  max: number | null;
  unit?: string | null;
};

/** Clave para comparar nombres de parámetros: "Fósforo  (P)" → "fosforo (p)". */
export function parameterKey(name: string): string {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Compara un valor contra su rango. Un rango puede tener solo mínimo o solo
 * máximo (p. ej. "aluminio menor a 1"). Sin rango no hay diagnóstico.
 */
export function diagnose(value: number, range?: ReferenceRange | null): DiagnosisStatus {
  if (!range || (range.min == null && range.max == null)) return 'SIN_REFERENCIA';
  if (range.min != null && value < range.min) return 'BAJO';
  if (range.max != null && value > range.max) return 'ALTO';
  return 'OPTIMO';
}

function formatRange(range: ReferenceRange): string {
  const unit = range.unit ? ` ${range.unit}` : '';
  if (range.min != null && range.max != null) return `${range.min}–${range.max}${unit}`;
  if (range.min != null) return `mínimo ${range.min}${unit}`;
  return `máximo ${range.max}${unit}`;
}

/**
 * Texto de la recomendación automática para un parámetro fuera de rango.
 * Es deliberadamente general: señala el problema y remite al técnico, que es
 * quien agrega la recomendación concreta (práctica o bioinsumo).
 */
export function automaticRecommendation(parameter: string, value: number, status: DiagnosisStatus, range: ReferenceRange): string | null {
  if (status !== 'BAJO' && status !== 'ALTO') return null;
  const unit = range.unit ? ` ${range.unit}` : '';
  const direction = status === 'BAJO' ? 'por debajo' : 'por encima';
  return `${parameter}: ${value}${unit} está ${direction} del rango de referencia (${formatRange(range)}). Revisa con tu técnico una corrección antes de aplicar insumos.`;
}

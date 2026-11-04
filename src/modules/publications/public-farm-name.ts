/**
 * Nombre de finca apto para el portal público (ASR-15: sin datos personales).
 *
 * El registro de agricultores trae fincas nombradas "PROPIETARIO - FINCA"
 * (por ejemplo "ALBA LUZ PROANOS - ESPERANZA"). Internamente ese nombre se
 * conserva porque distingue fincas homónimas de distintos dueños al importar,
 * pero en público solo se muestra lo que va después del primer " - ".
 */
export function publicFarmName(name: string): string {
  const separator = name.indexOf(' - ');
  if (separator <= 0) return name.trim();
  const farm = name.slice(separator + 3).trim();
  return farm || name.slice(0, separator).trim();
}

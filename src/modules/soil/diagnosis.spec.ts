import { automaticRecommendation, diagnose, parameterKey } from './diagnosis';

describe('diagnóstico de suelo', () => {
  it('normaliza nombres de parámetros', () => {
    expect(parameterKey('  Fósforo   (P) ')).toBe('fosforo (p)');
    expect(parameterKey('Materia Orgánica')).toBe(parameterKey('materia organica'));
  });

  it('clasifica contra un rango completo', () => {
    const ph = { min: 5.8, max: 6.5 };
    expect(diagnose(5.0, ph)).toBe('BAJO');
    expect(diagnose(5.8, ph)).toBe('OPTIMO');
    expect(diagnose(6.5, ph)).toBe('OPTIMO');
    expect(diagnose(7.1, ph)).toBe('ALTO');
  });

  it('acepta rangos con solo mínimo o solo máximo', () => {
    expect(diagnose(0.5, { min: null, max: 1 })).toBe('OPTIMO');
    expect(diagnose(2, { min: null, max: 1 })).toBe('ALTO');
    expect(diagnose(10, { min: 20, max: null })).toBe('BAJO');
  });

  it('sin rango no inventa un diagnóstico', () => {
    expect(diagnose(6.2, null)).toBe('SIN_REFERENCIA');
    expect(diagnose(6.2, { min: null, max: null })).toBe('SIN_REFERENCIA');
  });

  it('solo recomienda para valores fuera de rango', () => {
    const range = { min: 20, max: 40, unit: 'mg/kg' };
    expect(automaticRecommendation('Fósforo', 18, 'BAJO', range)).toBe(
      'Fósforo: 18 mg/kg está por debajo del rango de referencia (20–40 mg/kg). Revisa con tu técnico una corrección antes de aplicar insumos.',
    );
    expect(automaticRecommendation('Fósforo', 30, 'OPTIMO', range)).toBeNull();
    expect(automaticRecommendation('Fósforo', 30, 'SIN_REFERENCIA', range)).toBeNull();
  });
});

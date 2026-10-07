import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsDate,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class SoilParameterDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  value: number;

  @IsOptional()
  @IsString()
  unit?: string;
}

export class CreateSoilAnalysisDto {
  @IsUUID()
  farmId: string;

  @IsOptional()
  @IsUUID()
  lotId?: string;

  @Type(() => Date)
  @IsDate()
  date: Date;

  @IsOptional()
  @IsString()
  laboratory?: string;

  /** Resultados del laboratorio. Los rangos salen del catálogo SoilReferenceRange. */
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => SoilParameterDto)
  parameters: SoilParameterDto[];

  @IsOptional()
  @IsString()
  observations?: string;
}

export const RECOMMENDATION_TYPES = ['PRACTICA', 'BIOINSUMO'] as const;

export class CreateRecommendationDto {
  /** Toda recomendación cuelga de un diagnóstico (RF-12); el análisis se deduce de él. */
  @IsUUID()
  diagnosisId: string;

  @IsIn(RECOMMENDATION_TYPES)
  type: (typeof RECOMMENDATION_TYPES)[number];

  @IsString()
  @IsNotEmpty()
  description: string;

  /** Obligatorio si type es BIOINSUMO. Debe ser de la misma finca del análisis. */
  @ValidateIf((dto: CreateRecommendationDto) => dto.type === 'BIOINSUMO' || dto.bioinputId !== undefined)
  @IsUUID()
  bioinputId?: string;
}

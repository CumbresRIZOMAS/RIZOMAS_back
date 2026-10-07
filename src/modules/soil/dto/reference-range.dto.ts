import { PartialType } from '@nestjs/mapped-types';
import { IsNotEmpty, IsNumber, IsOptional, IsString, ValidateIf } from 'class-validator';

export class CreateReferenceRangeDto {
  @IsString()
  @IsNotEmpty()
  parameter: string;

  /** Cultivo al que aplica (p. ej. "Café arábica"). Vacío u omitido: cualquier cultivo. */
  @IsOptional()
  @IsString()
  crop?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  /** Al menos uno de min/max es obligatorio. */
  @ValidateIf((dto: CreateReferenceRangeDto) => dto.max === undefined || dto.max === null)
  @IsNumber()
  min?: number | null;

  @ValidateIf((dto: CreateReferenceRangeDto) => dto.min === undefined || dto.min === null)
  @IsNumber()
  max?: number | null;

  /** De dónde sale el rango (p. ej. "Cenicafé, Avances Técnicos 2023"). */
  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateReferenceRangeDto extends PartialType(CreateReferenceRangeDto) {}

import { Type } from 'class-transformer';
import { IsArray, IsDate, IsNotEmpty, IsNumber, IsObject, IsOptional, IsPositive, IsString, IsUUID, ValidateNested } from 'class-validator';

/** Un componente de la composición del bioinsumo (RF-13). */
export class IngredientDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  quantity?: number;

  @IsOptional()
  @IsString()
  unit?: string;
}

export class CreateBioinputDto {
  @IsUUID()
  farmId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  /** Datos libres de la receta (tiempos, temperatura, fermentación...). */
  @IsOptional()
  @IsObject()
  recipe?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IngredientDto)
  ingredients?: IngredientDto[];

  @IsOptional()
  @IsString()
  preparation?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  producedAt?: Date;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  quantity?: number;

  @IsOptional()
  @IsString()
  unit?: string;
}

export class ApplyBioinputDto {
  @IsUUID()
  bioinputId: string;

  /** Debe ser un lote de la misma finca del bioinsumo. */
  @IsUUID()
  lotId: string;

  @IsOptional()
  @IsUUID()
  laborId?: string;

  @Type(() => Date)
  @IsDate()
  appliedAt: Date;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  quantity?: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  observations?: string;
}

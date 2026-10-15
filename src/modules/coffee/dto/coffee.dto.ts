import { Type } from 'class-transformer';
import { IsDate, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateCoffeeProcessDto {
  @IsUUID()
  farmId: string;

  @IsOptional()
  @IsUUID()
  harvestId?: string;

  @IsString()
  currentStage: string;

  @Type(() => Date)
  @IsDate()
  startedAt: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  finishedAt?: Date;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateCoffeeProcessDto {
  @IsOptional()
  @IsString()
  currentStage?: string;

  /** Cierra el proceso. null lo reabre. */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  finishedAt?: Date | null;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateProductFinalDto {
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  finalizedAt?: Date;

  /** Ej. "Café tostado 340 g · exportación". */
  @IsOptional()
  @IsString()
  destination?: string;
}

export class CreateCertificationDto {
  @IsString()
  @IsNotEmpty()
  certifier: string;

  /** Ej. EN_TRAMITE, VIGENTE, VENCIDA. */
  @IsString()
  @IsNotEmpty()
  status: string;
}

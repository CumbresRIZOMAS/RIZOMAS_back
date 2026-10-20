import { Type } from 'class-transformer';
import { IsBoolean, IsDate, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateCoffeeProcessDto {
  @IsUUID()
  farmId: string;

  @IsOptional()
  @IsUUID()
  harvestId?: string;

  @IsOptional()
  @IsUUID()
  lotId?: string;

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

export class CreateCoffeeProcessEventDto {
  @IsString() @IsNotEmpty() stage: string;
  @Type(() => Date) @IsDate() recordedAt: Date;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) inputKg?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) outputKg?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) waterLiters?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) wastewaterLiters?: number;
  @IsOptional() @IsBoolean() compostReuse?: boolean;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) durationHours?: number;
  @IsOptional() @IsString() method?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) brix?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) ph?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) moisturePercent?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) scaScore?: number;
  @IsOptional() @IsString() notes?: string;
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

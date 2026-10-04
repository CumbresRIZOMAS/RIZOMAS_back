import { Type } from 'class-transformer';
import { IsDate, IsNumber, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateBioinputDto {
  @IsUUID()
  farmId: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsObject()
  recipe?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  ingredients?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  preparation?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  producedAt?: Date;

  @IsOptional()
  @IsNumber()
  quantity?: number;

  @IsOptional()
  @IsString()
  unit?: string;
}

export class ApplyBioinputDto {
  @IsUUID()
  bioinputId: string;

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
  quantity?: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  observations?: string;
}

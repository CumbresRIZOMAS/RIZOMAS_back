import { EvidenceStatus, Visibility } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsNumber, IsObject, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class CreateEvidenceDto {
  @IsOptional()
  @IsUUID()
  farmId?: string;

  @IsOptional()
  @IsUUID()
  lotId?: string;

  @IsOptional()
  @IsUUID()
  laborId?: string;

  @IsOptional()
  @IsUUID()
  harvestId?: string;

  @IsOptional()
  @IsUUID()
  coffeeProcessId?: string;

  @IsOptional()
  @IsUUID()
  productFinalId?: string;

  @IsString()
  objectKey: string;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  capturedAt?: Date;

  @IsOptional()
  @IsObject()
  geolocation?: Record<string, unknown>;

  @IsOptional()
  @IsEnum(Visibility)
  visibility?: Visibility;
}

export class ModerateEvidenceDto {
  @IsEnum(EvidenceStatus)
  status: EvidenceStatus;

  @IsOptional()
  @IsObject()
  moderation?: Record<string, unknown>;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  moderationScore?: number;

  @IsOptional()
  @IsString()
  moderationEngine?: string;

  @IsOptional()
  @IsString()
  rejectionReason?: string;
}

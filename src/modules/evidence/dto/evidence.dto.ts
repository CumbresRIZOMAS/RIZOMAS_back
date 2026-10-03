import { EvidenceStatus, Visibility } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

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
}

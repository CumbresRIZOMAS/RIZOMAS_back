import { Type } from 'class-transformer';
import { OmitType, PartialType } from '@nestjs/mapped-types';
import { ArrayMaxSize, IsArray, IsBoolean, IsNumber, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreatePublicationDto {
  @IsUUID()
  farmId: string;

  @IsOptional()
  @IsUUID()
  harvestId?: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  quantity?: number;

  @IsOptional()
  @IsString()
  unit?: string;

  /** Punto aproximado que la finca decide mostrar en el mapa público. */
  @IsOptional()
  @IsObject()
  publicLocation?: Record<string, unknown>;
}

export class UpdatePublicationDto extends PartialType(OmitType(CreatePublicationDto, ['farmId'] as const)) {}

/** Fotos que acompañan la publicación; reemplaza la selección anterior. */
export class SetPublicationEvidencesDto {
  @IsArray()
  @ArrayMaxSize(12)
  @IsUUID('all', { each: true })
  evidenceIds: string[];
}

export class PublishPublicationDto {
  @IsBoolean()
  active: boolean;
}

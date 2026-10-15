import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

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
  region?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  quantity?: number;

  @IsOptional()
  @IsString()
  unit?: string;
}

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

import { Type } from 'class-transformer';
import { IsArray, IsDate, IsObject, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';

export class SoilParameterDto {
  @IsString()
  name: string;

  value: number;

  @IsOptional()
  min?: number;

  @IsOptional()
  max?: number;
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

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SoilParameterDto)
  parameters: SoilParameterDto[];

  @IsOptional()
  @IsString()
  observations?: string;
}

export class CreateRecommendationDto {
  @IsOptional()
  @IsUUID()
  soilAnalysisId?: string;

  @IsString()
  type: string;

  @IsString()
  description: string;
}

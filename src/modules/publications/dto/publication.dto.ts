import { Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

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

export class PublishPublicationDto {
  @IsBoolean()
  active: boolean;
}

import { FarmType, Visibility } from '@prisma/client';
import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsNumber, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateFarmDto {
  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  identifier?: string;

  @IsOptional()
  @IsString()
  municipality?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsNumber()
  areaHa?: number;

  @IsOptional()
  @IsString()
  climate?: string;

  @IsOptional()
  @IsEnum(FarmType)
  farmType?: FarmType;

  @IsOptional()
  @IsObject()
  exactLocation?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  publicLocation?: Record<string, unknown>;

  @IsOptional()
  @IsEnum(Visibility)
  locationVisibility?: Visibility;
}

export class UpdateFarmDto extends PartialType(CreateFarmDto) {}

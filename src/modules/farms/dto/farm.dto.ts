import { FarmType, Visibility } from '@prisma/client';
import { PartialType } from '@nestjs/mapped-types';
import { ArrayMaxSize, ArrayUnique, IsArray, IsEmail, IsEnum, IsLatitude, IsLongitude, IsNumber, IsObject, IsOptional, IsString, IsUrl, IsUUID, Matches, MaxLength } from 'class-validator';

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
  @IsString()
  village?: string;

  @IsOptional()
  @IsNumber()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @IsLongitude()
  longitude?: number;

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

  @IsOptional() @IsString() @MaxLength(1600) publicDescription?: string;
  @IsOptional() @IsEmail() publicContactEmail?: string;
  @IsOptional() @IsString() @Matches(/^[+\d ()-]{7,24}$/) publicContactPhone?: string;
  @IsOptional() @IsUrl() publicWebsite?: string;
  @IsOptional() @IsUrl() publicInstagram?: string;
  @IsOptional() @IsUrl() publicFacebook?: string;
  @IsOptional() @IsString() @Matches(/^[+\d ()-]{7,24}$/) publicWhatsapp?: string;
  @IsOptional() @IsArray() @ArrayUnique() @ArrayMaxSize(12) @IsUUID('4', { each: true }) publicImageIds?: string[];
}

export class UpdateFarmDto extends PartialType(CreateFarmDto) {}

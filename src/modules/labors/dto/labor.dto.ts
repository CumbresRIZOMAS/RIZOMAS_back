import { AgronomicManagementType, LaborType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsInt, IsNumber, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateLaborDto {
  @IsUUID()
  farmId: string;

  @IsOptional()
  @IsUUID()
  lotId?: string;

  @IsOptional()
  @IsUUID()
  cropId?: string;

  @IsOptional()
  @IsUUID()
  workerId?: string;

  @IsEnum(LaborType)
  type: LaborType;

  @IsString()
  name: string;

  @Type(() => Date)
  @IsDate()
  startDate: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endDate?: Date;

  @IsOptional()
  @IsInt()
  durationMin?: number;

  @IsOptional()
  @IsString()
  observations?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreateHarvestDto extends CreateLaborDto {
  @IsOptional()
  @IsUUID()
  harvestCropId?: string;

  @IsNumber()
  quantity: number;

  @IsString()
  unit: string;

  @IsOptional()
  @IsString()
  quality?: string;

  @IsOptional()
  @IsString()
  destination?: string;
}

export class CreateAgronomicManagementDto extends CreateLaborDto {
  @IsEnum(AgronomicManagementType)
  managementType: AgronomicManagementType;

  @IsOptional()
  @IsNumber()
  quantity?: number;
}

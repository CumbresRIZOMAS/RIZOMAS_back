import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsString, IsUUID } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateCycleDto {
  @IsUUID()
  cropId: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  plantingDate?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  productionStart?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  productionEnd?: Date;

  @IsOptional()
  @IsString()
  harvestFrequency?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateCycleDto extends PartialType(CreateCycleDto) {}

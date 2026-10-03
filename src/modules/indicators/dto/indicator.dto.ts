import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateIndicatorDto {
  @IsString()
  name: string;

  @IsString()
  category: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  unit?: string;
}

export class CreateIndicatorValueDto {
  @IsUUID()
  definitionId: string;

  @IsUUID()
  farmId: string;

  @IsOptional()
  @IsUUID()
  lotId?: string;

  @IsOptional()
  @Type(() => Date)
  periodStart?: Date;

  @IsOptional()
  @Type(() => Date)
  periodEnd?: Date;

  @Type(() => Number)
  @IsNumber()
  value: number;
}

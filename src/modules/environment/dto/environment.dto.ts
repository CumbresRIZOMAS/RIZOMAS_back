import { Type } from 'class-transformer';
import { IsDate, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateEnvironmentalConditionDto {
  @IsUUID()
  farmId: string;

  @IsOptional()
  @IsUUID()
  lotId?: string;

  @Type(() => Date)
  @IsDate()
  observedAt: Date;

  @IsString()
  type: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  value?: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  observations?: string;
}

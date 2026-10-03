import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateCoffeeProcessDto {
  @IsUUID()
  farmId: string;

  @IsOptional()
  @IsUUID()
  harvestId?: string;

  @IsString()
  currentStage: string;

  @Type(() => Date)
  @IsDate()
  startedAt: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  finishedAt?: Date;

  @IsOptional()
  @IsString()
  notes?: string;
}

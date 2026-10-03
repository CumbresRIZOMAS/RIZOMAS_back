import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateCropDto {
  @IsUUID()
  lotId: string;

  @IsString()
  species: string;

  @IsOptional()
  @IsString()
  variety?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  plantingDate?: Date;

  @IsOptional()
  @IsString()
  status?: string;
}

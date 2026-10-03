import { IsNumber, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateLotDto {
  @IsUUID()
  farmId: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  identifier?: string;

  @IsOptional()
  @IsNumber()
  areaHa?: number;

  @IsOptional()
  @IsObject()
  location?: Record<string, unknown>;
}

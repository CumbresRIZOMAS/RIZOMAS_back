import { IsLatitude, IsLongitude, IsNumber, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

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
  @IsNumber()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @IsLongitude()
  longitude?: number;

  @IsOptional()
  @IsObject()
  location?: Record<string, unknown>;
}

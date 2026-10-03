import { Type } from 'class-transformer';
import { IsBoolean, IsDate, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreatePurchaseDto {
  @IsUUID()
  farmId: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @Type(() => Date)
  @IsDate()
  date: Date;

  @IsString()
  itemName: string;

  @IsOptional()
  @IsBoolean()
  isBioinput?: boolean;

  @IsNumber()
  quantity: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsNumber()
  value?: number;
}

export class CreateSaleDto {
  @IsUUID()
  farmId: string;

  @Type(() => Date)
  @IsDate()
  date: Date;

  @IsString()
  productName: string;

  @IsOptional()
  @IsString()
  buyer?: string;

  @IsNumber()
  quantity: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsNumber()
  value?: number;
}

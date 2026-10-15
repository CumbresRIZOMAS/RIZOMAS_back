import { Type } from 'class-transformer';
import { IsBoolean, IsDate, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreatePurchaseDto {
  @IsUUID()
  farmId: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  /**
   * Alternativa a supplierId para la app (offline): el nombre del proveedor.
   * Si no existe en el catálogo se crea.
   */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  supplierName?: string;

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

import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsString, IsUUID } from 'class-validator';

export class ReportQueryDto {
  @IsOptional()
  @IsUUID()
  farmId?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;

  @IsOptional()
  @IsString()
  type?: string;
}

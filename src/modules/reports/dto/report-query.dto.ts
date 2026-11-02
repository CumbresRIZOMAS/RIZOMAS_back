import { Type } from 'class-transformer';
import { IsDate, IsIn, IsOptional, IsUUID } from 'class-validator';

export const REPORT_TYPES = ['production', 'environmental', 'technical', 'social', 'commercial', 'traceability'] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

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

  @IsIn(REPORT_TYPES)
  type: ReportType = 'production';
}

import { IsArray, IsObject, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class SyncOperationDto {
  @IsString()
  clientUuid: string;

  @IsString()
  entity: string;

  @IsString()
  operation: string;

  @IsObject()
  payload: Record<string, unknown>;
}

export class SyncBatchDto {
  @IsUUID()
  userId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncOperationDto)
  operations: SyncOperationDto[];
}

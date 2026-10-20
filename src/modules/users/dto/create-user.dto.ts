import { IsBoolean, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { OmitType, PartialType } from '@nestjs/mapped-types';
import { AppRole } from '../../../common/enums/app-role.enum';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  @IsEnum(AppRole)
  role: AppRole;

  @IsOptional()
  @IsUUID()
  farmId?: string;
}

export class UpdateUserDto extends PartialType(OmitType(CreateUserDto, ['farmId'] as const)) {}

export class UpdateUserStatusDto {
  @IsBoolean()
  active: boolean;
}

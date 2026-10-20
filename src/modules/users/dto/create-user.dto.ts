import { ArrayUnique, IsArray, IsBoolean, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
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

  @IsString()
  @MinLength(8)
  password: string;

  @IsOptional()
  @IsUUID()
  farmId?: string;

  /** Fincas a las que se vincula la persona durante la creación de la cuenta. */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  farmIds?: string[];
}

export class UpdateUserDto extends PartialType(OmitType(CreateUserDto, ['farmId', 'password'] as const)) {}

export class UpdateUserStatusDto {
  @IsBoolean()
  active: boolean;
}

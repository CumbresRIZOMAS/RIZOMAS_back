import { ArrayUnique, IsArray, IsBoolean, IsEmail, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, Min, MinLength } from 'class-validator';
import { OmitType, PartialType } from '@nestjs/mapped-types';
import { AppRole } from '../../../common/enums/app-role.enum';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional() @IsString() documentNumber?: string;
  @IsOptional() @IsString() associationCode?: string;
  @IsOptional() @IsString() associationName?: string;
  @IsOptional() @IsString() secondLevelGroup?: string;
  @IsOptional() @IsString() sex?: string;
  @IsOptional() @IsInt() @Min(0) @Max(130) age?: number;
  @IsOptional() @IsString() specialGroup?: string;
  @IsOptional() @IsString() educationLevel?: string;

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

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  lotIds?: string[];
}

export class UpdateUserDto extends PartialType(OmitType(CreateUserDto, ['farmId', 'password'] as const)) {}

export class UpdateUserStatusDto {
  @IsBoolean()
  active: boolean;
}

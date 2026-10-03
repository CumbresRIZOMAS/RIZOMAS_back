import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { AppRole } from '../../../common/enums/app-role.enum';

export class CreateUserDto {
  @IsOptional()
  @IsString()
  authUserId?: string;

  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsEnum(AppRole)
  role: AppRole;
}

export class AddFarmMemberDto {
  @IsUUID()
  userId: string;

  @IsEnum(AppRole)
  role: AppRole;
}

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { AllowPasswordSetup } from '../../common/decorators/allow-password-setup.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { UsersService } from '../users/users.service';

class ChangePasswordDto {
  @IsString()
  @MinLength(8)
  password: string;
}

@Controller('auth')
export class PasswordCredentialsController {
  constructor(private readonly users: UsersService) {}

  @Get('password-status')
  @AllowPasswordSetup()
  passwordStatus(@CurrentUser() user: RequestUser) {
    return this.users.passwordStatus(user);
  }

  @Post('change-password')
  @AllowPasswordSetup()
  changePassword(@Body() dto: ChangePasswordDto, @CurrentUser() user: RequestUser) {
    return this.users.changeOwnPassword(dto.password, user);
  }
}

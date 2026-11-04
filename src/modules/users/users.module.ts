import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { PasswordCredentialsController } from '../auth/password-credentials.controller';

@Module({
  controllers: [UsersController, PasswordCredentialsController],
  providers: [UsersService],
})
export class UsersModule {}

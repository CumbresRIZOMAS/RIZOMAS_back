import { Module } from '@nestjs/common';
import { AuthHooksController } from './auth-hooks.controller';

@Module({
  controllers: [AuthHooksController],
})
export class AuthHooksModule {}

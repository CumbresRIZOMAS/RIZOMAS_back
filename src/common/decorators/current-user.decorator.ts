import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type RequestUser = {
  sub: string;
  email?: string;
  role?: string;
  appUserId?: string;
};

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return request.user as RequestUser;
});

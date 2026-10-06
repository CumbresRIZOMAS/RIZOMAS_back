import { Controller, Headers, Post, RawBodyRequest, Req, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { Webhook } from 'standardwebhooks';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';

type AuthHookEvent = {
  user_id: string;
  claims: Record<string, unknown>;
};

type RequestWithRawBody = RawBodyRequest<Request>;

@Controller('auth/hooks')
export class AuthHooksController {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('custom-access-token')
  @Public()
  async customAccessToken(
    @Req() request: RequestWithRawBody,
    @Headers() headers: Record<string, string>,
  ) {
    const rawSecret = this.config.get<string>('SUPABASE_AUTH_HOOK_SECRET');
    if (!rawSecret) throw new UnauthorizedException('Auth Hook secret no configurado');
    const payload = request.rawBody;
    if (!payload) throw new UnauthorizedException('Payload original del Auth Hook no disponible');

    let event: AuthHookEvent;
    try {
      event = new Webhook(rawSecret).verify(payload, headers) as AuthHookEvent;
    } catch {
      throw new UnauthorizedException('Firma de Auth Hook invalida');
    }
    if (!event.user_id || !event.claims) {
      throw new UnauthorizedException('Payload de Auth Hook incompleto');
    }
    const user = await this.prisma.user.findFirst({
      where: { authUserId: event.user_id },
      select: { role: true, active: true },
    });

    const role = user?.active === false ? 'PUBLICO' : user?.role ?? 'PUBLICO';
    return {
      claims: {
        ...event.claims,
        user_role: role,
        app_metadata: {
          ...((event.claims.app_metadata as Record<string, unknown> | undefined) ?? {}),
          user_role: role,
        },
      },
    };
  }
}

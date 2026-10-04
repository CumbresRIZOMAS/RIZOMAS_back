import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request.headers.authorization);
    if (!token) throw new UnauthorizedException('Token de autenticacion requerido');

    try {
      const payload = await this.verifyToken(token);
      const localUser = await this.prisma.user.findFirst({
        where: { OR: [{ authUserId: payload.sub }, ...(payload.email ? [{ email: payload.email }] : [])] },
        select: { id: true, role: true, active: true },
      });
      if (localUser && !localUser.active) throw new UnauthorizedException('Usuario inactivo');
      request.user = {
        sub: payload.sub,
        email: payload.email,
        role: localUser?.role ?? payload.user_role ?? payload.app_metadata?.user_role ?? payload.role,
        appUserId: localUser?.id,
      };
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Token invalido o expirado');
    }
  }

  private async verifyToken(token: string): Promise<JWTPayload & { user_role?: string; app_metadata?: { user_role?: string }; role?: string }> {
    const secret = this.config.get<string>('SUPABASE_JWT_SECRET');
    if (secret) {
      return this.jwtService.verifyAsync(token, { secret });
    }

    const jwksUrl = this.config.get<string>('SUPABASE_JWKS_URL');
    if (!jwksUrl) throw new Error('SUPABASE_JWT_SECRET o SUPABASE_JWKS_URL no configurado');
    const { payload } = await jwtVerify(token, createRemoteJWKSet(new URL(jwksUrl)), {
      issuer: this.config.get<string>('SUPABASE_URL') ? `${this.config.get<string>('SUPABASE_URL')}/auth/v1` : undefined,
    });
    return payload as JWTPayload & { user_role?: string; app_metadata?: { user_role?: string }; role?: string };
  }

  private extractToken(authorization?: string): string | undefined {
    const [type, token] = authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}

import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
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
      const secret = this.config.get<string>('SUPABASE_JWT_SECRET');
      if (!secret) throw new Error('SUPABASE_JWT_SECRET no configurado');
      const payload = await this.jwtService.verifyAsync(token, { secret });
      request.user = {
        sub: payload.sub,
        email: payload.email,
        role: payload.user_role ?? payload.app_metadata?.user_role ?? payload.role,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Token invalido o expirado');
    }
  }

  private extractToken(authorization?: string): string | undefined {
    const [type, token] = authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}

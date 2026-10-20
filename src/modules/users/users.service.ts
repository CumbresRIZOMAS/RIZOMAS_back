import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { User } from '@prisma/client';
import { AppRole } from '../../common/enums/app-role.enum';
import { RequestUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../../common/services/audit.service';
import { FarmAccessService } from '../../common/services/farm-access.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto } from './dto/create-user.dto';

const ROLES_ADMIN_FINCA = Object.values(AppRole).filter((role) => role !== AppRole.ADMIN_CUMBRES);

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly access: FarmAccessService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateUserDto, actor: RequestUser) {
    this.assertRoleCanBeAssigned(actor, dto.role);
    if (dto.farmId) await this.access.assertAccess(actor, dto.farmId);
    if ([AppRole.ADMIN_FINCA, AppRole.TECNICO, AppRole.AGRICULTOR].includes(dto.role) && !dto.farmId) {
      throw new BadRequestException('Selecciona la finca a la que pertenecerá este usuario');
    }
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (existing) throw new ConflictException('Ya existe un usuario con ese correo');

    const invited = await this.authRequest('/invite', 'POST', {
      email: dto.email.toLowerCase(),
      data: { full_name: dto.name.trim() },
    }, { redirectTo: this.redirectUrl() });
    const authUserId = typeof invited.id === 'string' ? invited.id : null;
    if (!authUserId) throw new ServiceUnavailableException('Supabase no devolvió el identificador de la invitación');

    let user: User;
    try {
      user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({ data: { authUserId, name: dto.name.trim(), email: dto.email.toLowerCase(), role: dto.role } });
        if (dto.farmId) await tx.farmUser.create({ data: { farmId: dto.farmId, userId: created.id, role: dto.role } });
        return created;
      });
    } catch (error) {
      // No deja una identidad de Supabase huérfana si la transacción local falla.
      await this.authRequest(`/admin/users/${authUserId}`, 'DELETE').catch(() => undefined);
      throw error;
    }
    await this.audit.record({ userId: actor.appUserId ?? actor.sub, entity: 'User', entityId: user.id, action: 'INVITE', after: user });
    return user;
  }

  async findAll(actor: RequestUser) {
    const farmIds = await this.access.accessibleFarmIds(actor);
    const where = farmIds === null
      ? {}
      : { OR: [
          { id: actor.appUserId ?? '' },
          { farmMembers: { some: { farmId: { in: farmIds } } } },
          { ownedFarms: { some: { id: { in: farmIds } } } },
        ] };
    return this.prisma.user.findMany({ where, orderBy: { createdAt: 'desc' } });
  }

  async update(id: string, dto: UpdateUserDto, actor: RequestUser) {
    const before = await this.assertCanManage(id, actor);
    if (dto.role) this.assertRoleCanBeAssigned(actor, dto.role, before.role);
    if (dto.email && dto.email.toLowerCase() !== before.email.toLowerCase()) {
      const duplicate = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
      if (duplicate) throw new ConflictException('Ya existe un usuario con ese correo');
    }
    const email = dto.email?.trim().toLowerCase();
    if (before.authUserId && (email || dto.name)) {
      await this.authRequest(`/admin/users/${before.authUserId}`, 'PUT', {
        ...(email ? { email, email_confirm: true } : {}),
        ...(dto.name ? { user_metadata: { full_name: dto.name.trim() } } : {}),
      });
    }
    const after = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: { ...dto, ...(email ? { email } : {}), ...(dto.name ? { name: dto.name.trim() } : {}) },
      });
      if (dto.role) await tx.farmUser.updateMany({ where: { userId: id }, data: { role: dto.role } });
      return updated;
    });
    await this.audit.record({ userId: actor.appUserId ?? actor.sub, entity: 'User', entityId: id, action: 'UPDATE', before, after });
    return after;
  }

  async setStatus(id: string, active: boolean, actor: RequestUser) {
    const before = await this.assertCanManage(id, actor);
    if (id === actor.appUserId) throw new BadRequestException('No puedes desactivar tu propio usuario');
    if (before.authUserId) {
      await this.authRequest(`/admin/users/${before.authUserId}`, 'PUT', { ban_duration: active ? 'none' : '876000h' });
    }
    const after = await this.prisma.user.update({ where: { id }, data: { active } });
    await this.audit.record({ userId: actor.appUserId ?? actor.sub, entity: 'User', entityId: id, action: active ? 'ACTIVATE' : 'DEACTIVATE', before, after });
    return after;
  }

  async resetPassword(id: string, actor: RequestUser) {
    const user = await this.assertCanManage(id, actor);
    if (!user.authUserId) throw new BadRequestException('Este usuario no tiene una cuenta vinculada en Supabase Auth');
    const anonKey = this.config.get<string>('SUPABASE_ANON_KEY');
    const url = this.config.get<string>('SUPABASE_URL')?.replace(/\/$/, '');
    if (!anonKey || !url) throw new ServiceUnavailableException('Configura SUPABASE_URL y SUPABASE_ANON_KEY en el backend');
    const redirectTo = encodeURIComponent(`${this.redirectUrl()}/restablecer-contrasena`);
    const response = await fetch(`${url}/auth/v1/recover?redirect_to=${redirectTo}`, {
      method: 'POST',
      headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email }),
    });
    if (!response.ok) throw new BadRequestException(await this.authError(response));
    await this.audit.record({ userId: actor.appUserId ?? actor.sub, entity: 'User', entityId: id, action: 'PASSWORD_RESET_REQUEST' });
    return { sent: true };
  }

  async remove(id: string, actor: RequestUser) {
    const user = await this.assertCanManage(id, actor);
    if (id === actor.appUserId) throw new BadRequestException('No puedes eliminar tu propio usuario');
    const owned = await this.prisma.farm.findMany({ where: { ownerId: id }, select: { id: true } });
    if (owned.length && !actor.appUserId) throw new BadRequestException('No se pudo identificar al administrador para transferir las fincas');
    if (owned.length && actor.role !== AppRole.ADMIN_CUMBRES) {
      const actorFarms = await this.access.accessibleFarmIds(actor);
      if (!actorFarms || owned.some((farm) => !actorFarms.includes(farm.id))) {
        throw new ForbiddenException('No puedes eliminar este usuario porque es propietario de una finca fuera de tu acceso');
      }
    }
    if (user.authUserId) {
      // Bloquea el acceso antes de borrar la identidad. Si Supabase falla, no queda activa.
      await this.prisma.user.update({ where: { id }, data: { active: false } });
      await this.authRequest(`/admin/users/${user.authUserId}`, 'DELETE');
      await this.prisma.user.update({ where: { id }, data: { authUserId: null } });
    }
    await this.audit.record({ userId: actor.appUserId ?? actor.sub, entity: 'User', entityId: id, action: 'DELETE', before: user });
    try {
      await this.prisma.$transaction(async (tx) => {
        if (owned.length) await tx.farm.updateMany({ where: { ownerId: id }, data: { ownerId: actor.appUserId! } });
        await tx.user.delete({ where: { id } });
      });
    } catch (error) {
      if (user.authUserId) await this.prisma.user.update({ where: { id }, data: { authUserId: null, active: false } }).catch(() => undefined);
      throw error;
    }
    return { deleted: true, farmsTransferred: owned.length };
  }

  async findOne(id: string, actor: RequestUser) {
    const user = await this.assertCanManage(id, actor);
    return this.prisma.user.findUnique({
      where: { id },
      include: { farmMembers: { include: { farm: true } }, ownedFarms: true },
    });
  }

  private async assertCanManage(id: string, actor: RequestUser) {
    const user = await this.prisma.user.findUnique({ where: { id }, include: { farmMembers: { select: { farmId: true } }, ownedFarms: { select: { id: true } } } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (actor.role === AppRole.ADMIN_CUMBRES) return user;
    if (user.role === AppRole.ADMIN_CUMBRES) throw new ForbiddenException('Un administrador de finca no puede administrar usuarios de Cumbres Sacras');
    const actorFarms = await this.access.accessibleFarmIds(actor);
    const userFarms = [...user.farmMembers.map((m) => m.farmId), ...user.ownedFarms.map((f) => f.id)];
    if (!actorFarms || !userFarms.some((farmId) => actorFarms.includes(farmId))) throw new ForbiddenException('No tienes acceso a este usuario');
    return user;
  }

  private assertRoleCanBeAssigned(actor: RequestUser, role: AppRole, currentRole?: AppRole) {
    if (actor.role === AppRole.ADMIN_CUMBRES) return;
    if (currentRole === AppRole.ADMIN_CUMBRES || role === AppRole.ADMIN_CUMBRES || !ROLES_ADMIN_FINCA.includes(role)) {
      throw new ForbiddenException('Un administrador de finca no puede asignar el rol de administrador de Cumbres Sacras');
    }
  }

  private redirectUrl() {
    return (this.config.get<string>('WEB_APP_URL') ?? 'http://localhost:5173').replace(/\/$/, '');
  }

  private async authRequest(path: string, method: string, body?: unknown, options?: { redirectTo?: string }) {
    const url = this.config.get<string>('SUPABASE_URL')?.replace(/\/$/, '');
    const key = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) throw new ServiceUnavailableException('Configura SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el backend');
    const query = options?.redirectTo ? `?redirect_to=${encodeURIComponent(options.redirectTo)}` : '';
    const response = await fetch(`${url}/auth/v1${path}${query}`, {
      method,
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) throw new BadRequestException(await this.authError(response));
    if (response.status === 204) return {};
    return response.json() as Promise<Record<string, unknown>>;
  }

  private async authError(response: Response) {
    const data = await response.json().catch(() => ({})) as { msg?: string; message?: string; error_description?: string };
    return data.msg ?? data.message ?? data.error_description ?? 'Supabase no pudo completar la operación';
  }
}

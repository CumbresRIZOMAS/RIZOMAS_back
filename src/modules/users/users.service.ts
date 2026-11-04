import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import type { User } from '@prisma/client';
import { AppRole } from '../../common/enums/app-role.enum';
import { RequestUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../../common/services/audit.service';
import { FarmAccessService } from '../../common/services/farm-access.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto } from './dto/create-user.dto';
import { normalizePhoneForStorage, phoneLookupValues, toSupabasePhone } from '../../common/utils/phone';

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
    const email = dto.email?.trim().toLowerCase() || undefined;
    const phone = dto.phone?.trim() ? normalizePhoneForStorage(dto.phone) : undefined;
    if (!email && !phone) throw new BadRequestException('Escribe un correo o un celular para crear la cuenta');
    this.assertRoleCanBeAssigned(actor, dto.role);
    const farmIds = [...new Set([...(dto.farmIds ?? []), ...(dto.farmId ? [dto.farmId] : [])])];
    const lotIds = [...new Set(dto.lotIds ?? [])];
    for (const farmId of farmIds) await this.access.assertAccess(actor, farmId);
    const selectedLots = lotIds.length ? await this.prisma.lot.findMany({ where: { id: { in: lotIds } }, select: { id: true, farmId: true } }) : [];
    if (selectedLots.length !== lotIds.length) throw new BadRequestException('Uno o más lotes seleccionados no existen');
    for (const lot of selectedLots) {
      await this.access.assertAccess(actor, lot.farmId);
      if (!farmIds.includes(lot.farmId)) throw new BadRequestException('Cada lote debe pertenecer a una finca asignada al usuario');
    }
    if ([AppRole.ADMIN_FINCA, AppRole.TECNICO, AppRole.AGRICULTOR].includes(dto.role) && farmIds.length === 0) {
      throw new BadRequestException('Selecciona al menos una finca a la que pertenecerá este usuario');
    }
    const existingEmailUser = email ? await this.prisma.user.findUnique({ where: { email } }) : null;
    if (existingEmailUser?.authUserId) throw new ConflictException('Ya existe un usuario con ese correo');
    if (phone && await this.prisma.user.findFirst({ where: { phone: { in: phoneLookupValues(phone) }, authUserId: { not: null } } })) {
      throw new ConflictException('Ya existe una cuenta de acceso con ese celular');
    }
    const phoneProfiles = phone
      ? await this.prisma.user.findMany({ where: { phone: { in: phoneLookupValues(phone) }, authUserId: null }, take: 2 })
      : [];
    const documentProfiles = dto.documentNumber?.trim()
      ? await this.prisma.user.findMany({ where: { documentNumber: dto.documentNumber.trim(), authUserId: null }, take: 2 })
      : [];
    if (phone && !email && phoneProfiles.length > 1 && documentProfiles.length !== 1) {
      throw new BadRequestException('Este celular aparece en varios registros. Usa el documento de identidad para identificar a la persona.');
    }
    const profileToActivate = existingEmailUser ??
      (phoneProfiles.length === 1 ? phoneProfiles[0] : null) ??
      (documentProfiles.length === 1 ? documentProfiles[0] : null);
    const passwordChangeRequired = Boolean(dto.documentNumber?.trim()) &&
      dto.password.replace(/\D/g, '') === dto.documentNumber!.replace(/\D/g, '');

    const createdAuthUser = await this.authRequest('/admin/users', 'POST', {
      ...(email ? { email, email_confirm: true } : {}),
      ...(phone ? { phone: toSupabasePhone(phone), phone_confirm: true } : {}),
      password: dto.password,
      user_metadata: {
        full_name: dto.name.trim(),
          ...(phone ? { phone: toSupabasePhone(phone) } : {}),
        ...(dto.documentNumber ? { document_number: dto.documentNumber.trim() } : {}),
        password_change_required: passwordChangeRequired,
      },
    });
    const authUserId = typeof createdAuthUser.id === 'string' ? createdAuthUser.id : null;
    if (!authUserId) throw new ServiceUnavailableException('Supabase no devolvió el identificador de la cuenta creada');

    let user: User;
    try {
      user = await this.prisma.$transaction(async (tx) => {
        const profileData = {
          authUserId,
          name: dto.name.trim(),
          email: email ?? null,
          phone: phone ?? null,
          role: dto.role,
          active: true,
          passwordChangeRequired,
          ...(dto.documentNumber?.trim() ? { documentNumber: dto.documentNumber.trim() } : {}),
          ...(dto.associationCode?.trim() ? { associationCode: dto.associationCode.trim() } : {}),
          ...(dto.associationName?.trim() ? { associationName: dto.associationName.trim() } : {}),
          ...(dto.secondLevelGroup?.trim() ? { secondLevelGroup: dto.secondLevelGroup.trim() } : {}),
          ...(dto.sex?.trim() ? { sex: dto.sex.trim() } : {}),
          ...(dto.age !== undefined ? { age: dto.age } : {}),
          ...(dto.specialGroup?.trim() ? { specialGroup: dto.specialGroup.trim() } : {}),
          ...(dto.educationLevel?.trim() ? { educationLevel: dto.educationLevel.trim() } : {}),
        };
        const created = profileToActivate
          ? await tx.user.update({ where: { id: profileToActivate.id }, data: profileData })
          : await tx.user.create({ data: profileData });
        if (farmIds.length) {
          await tx.farmUser.createMany({ data: farmIds.map((farmId) => ({ farmId, userId: created.id, role: dto.role })) });
        }
        if (lotIds.length) await tx.lotUser.createMany({ data: lotIds.map((lotId) => ({ lotId, userId: created.id })) });
        return created;
      });
    } catch (error) {
      // No deja una identidad de Supabase huérfana si la transacción local falla.
      await this.authRequest(`/admin/users/${authUserId}`, 'DELETE').catch(() => undefined);
      throw error;
    }
    await this.audit.record({ userId: actor.appUserId ?? actor.sub, entity: 'User', entityId: user.id, action: 'CREATE', after: user });
    return user;
  }

  async findAll(actor: RequestUser) {
    // Supabase Auth y la tabla local User pueden contener cuentas históricas
    // distintas: por ejemplo, cuentas móviles que todavía no habían llamado
    // al backend. El administrador de Cumbres sincroniza esas identidades para
    // que también aparezcan en el listado y puedan asignarles finca y rol.
    if (actor.role === AppRole.ADMIN_CUMBRES) await this.syncSupabaseUsers();

    const farmIds = await this.access.accessibleFarmIds(actor);
    const where = farmIds === null
      ? {}
      : { OR: [
          { id: actor.appUserId ?? '' },
          { farmMembers: { some: { farmId: { in: farmIds } } } },
          { ownedFarms: { some: { id: { in: farmIds } } } },
        ] };
    const farmScope = farmIds === null ? {} : { where: { id: { in: farmIds } } };
    return this.prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        farmMembers: {
          ...(farmIds === null ? {} : { where: { farmId: { in: farmIds } } }),
          select: { role: true, farm: { select: { id: true, name: true } } },
        },
        ownedFarms: { ...farmScope, select: { id: true, name: true } },
        lotMembers: {
          ...(farmIds === null ? {} : { where: { lot: { farmId: { in: farmIds } } } }),
          select: { lot: { select: { id: true, name: true, farmId: true } } },
        },
      },
    });
  }

  private async syncSupabaseUsers() {
    const pageSize = 100;
    for (let page = 1; ; page += 1) {
      const response = await this.authRequest(`/admin/users?page=${page}&per_page=${pageSize}`, 'GET');
      const authUsers = Array.isArray(response.users) ? response.users : [];

      for (const rawUser of authUsers) {
        if (!rawUser || typeof rawUser !== 'object') continue;
        const authUser = rawUser as {
          id?: unknown;
          email?: unknown;
          phone?: unknown;
          user_metadata?: Record<string, unknown>;
          banned_until?: unknown;
        };
        if (typeof authUser.id !== 'string') continue;

        const email = typeof authUser.email === 'string' && authUser.email.trim() ? authUser.email.trim().toLowerCase() : null;
        const phone = typeof authUser.phone === 'string' && authUser.phone.trim() ? normalizePhoneForStorage(authUser.phone) : null;
        if (!email && !phone) continue;
        const localUser = await this.prisma.user.findUnique({ where: { authUserId: authUser.id } }) ??
          (email ? await this.prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } }) : null) ??
          (phone ? await this.findUniqueLocalPhone(phone) : null);
        if (localUser) {
          if (!localUser.authUserId) {
            await this.prisma.user.update({ where: { id: localUser.id }, data: { authUserId: authUser.id } });
          }
          continue;
        }

        const metadata = authUser.user_metadata ?? {};
        const metadataName = [metadata.full_name, metadata.name, metadata.display_name]
          .find((value): value is string => typeof value === 'string' && value.trim().length > 0);
        const bannedUntil = typeof authUser.banned_until === 'string' ? Date.parse(authUser.banned_until) : NaN;
        try {
          await this.prisma.user.create({
            data: {
              authUserId: authUser.id,
              email,
              phone,
              name: metadataName?.trim() ?? email?.split('@')[0] ?? phone!,
              // El rol de Auth no se toma de user_metadata: los permisos se
              // asignan desde este panel y nunca desde datos editables por el usuario.
              role: AppRole.AGRICULTOR,
              active: !Number.isFinite(bannedUntil) || bannedUntil <= Date.now(),
            },
          });
        } catch (error) {
          // Dos administradores pueden abrir el listado al mismo tiempo. Si
          // uno ya creó el perfil, la sincronización sigue siendo idempotente.
          const linked = await this.prisma.user.findUnique({ where: { authUserId: authUser.id } });
          if (!linked) throw error;
        }
      }

      if (authUsers.length < pageSize) break;
    }
  }

  private async findUniqueLocalPhone(phone: string) {
    const matches = await this.prisma.user.findMany({ where: { phone: { in: phoneLookupValues(phone) } }, take: 2 });
    return matches.length === 1 ? matches[0] : null;
  }

  async update(id: string, dto: UpdateUserDto, actor: RequestUser) {
    const before = await this.assertCanManage(id, actor);
    if (dto.role) this.assertRoleCanBeAssigned(actor, dto.role, before.role as AppRole);
    const farmIds = dto.farmIds === undefined ? undefined : [...new Set(dto.farmIds)];
    const lotIds = dto.lotIds === undefined ? undefined : [...new Set(dto.lotIds)];
    const actorFarmIds = await this.access.accessibleFarmIds(actor);
    if (farmIds && actorFarmIds !== null) {
      for (const farmId of farmIds) await this.access.assertAccess(actor, farmId);
    }
    const inaccessibleMemberships = farmIds === undefined || actorFarmIds === null
      ? []
      : before.farmMembers.map((membership) => membership.farmId).filter((farmId) => !actorFarmIds.includes(farmId));
    const resultingFarmIds = farmIds === undefined ? undefined : [...new Set([...farmIds, ...inaccessibleMemberships])];
    if (lotIds !== undefined) {
      const selectedLots = lotIds.length ? await this.prisma.lot.findMany({ where: { id: { in: lotIds } }, select: { id: true, farmId: true } }) : [];
      if (selectedLots.length !== lotIds.length) throw new BadRequestException('Uno o más lotes seleccionados no existen');
      const currentFarmIds = [...new Set([...before.farmMembers.map((membership) => membership.farmId), ...before.ownedFarms.map((farm) => farm.id)])];
      const assignedFarmIds = resultingFarmIds ?? currentFarmIds;
      for (const lot of selectedLots) {
        await this.access.assertAccess(actor, lot.farmId);
        if (!assignedFarmIds.includes(lot.farmId)) throw new BadRequestException('Cada lote debe pertenecer a una finca asignada al usuario');
      }
    }
    const resultingRole: AppRole = dto.role ?? (before.role as AppRole);
    if (resultingFarmIds && [AppRole.ADMIN_FINCA, AppRole.TECNICO, AppRole.AGRICULTOR].includes(resultingRole) && resultingFarmIds.length === 0) {
      throw new BadRequestException('Este rol debe estar asignado al menos a una finca');
    }
    const email = dto.email?.trim().toLowerCase();
    const phone = dto.phone?.trim() ? normalizePhoneForStorage(dto.phone) : undefined;
    if (email && email !== before.email?.toLowerCase()) {
      const duplicate = await this.prisma.user.findUnique({ where: { email } });
      if (duplicate) throw new ConflictException('Ya existe un usuario con ese correo');
    }
    if (phone && phone !== normalizePhoneForStorage(before.phone ?? phone) && await this.prisma.user.findFirst({ where: { id: { not: id }, phone: { in: phoneLookupValues(phone) }, authUserId: { not: null } } })) {
      throw new ConflictException('Ya existe una cuenta de acceso con ese celular');
    }
    if (before.authUserId && (email || phone || dto.name)) {
      await this.authRequest(`/admin/users/${before.authUserId}`, 'PUT', {
        ...(email ? { email, email_confirm: true } : {}),
        ...(phone ? { phone: toSupabasePhone(phone), ...(!email && !before.email ? { phone_confirm: true } : {}) } : {}),
        ...(dto.name ? { user_metadata: { full_name: dto.name.trim() } } : {}),
      });
    }
    const userData = { ...dto };
    delete userData.farmIds;
    delete userData.lotIds;
    const after = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: { ...userData, ...(email ? { email } : {}), ...(phone ? { phone } : {}), ...(dto.name ? { name: dto.name.trim() } : {}) },
      });
      if (dto.role) {
        await tx.farmUser.updateMany({
          where: { userId: id, ...(actorFarmIds === null ? {} : { farmId: { in: actorFarmIds } }) },
          data: { role: dto.role },
        });
      }
      if (farmIds !== undefined) {
        const scopedFarmIds = actorFarmIds === null ? null : actorFarmIds;
        await tx.farmUser.deleteMany({
          where: { userId: id, ...(scopedFarmIds === null ? {} : { farmId: { in: scopedFarmIds } }) },
        });
        const membershipsToCreate = resultingFarmIds!.filter((farmId) => scopedFarmIds === null || scopedFarmIds.includes(farmId));
        if (membershipsToCreate.length) {
          await tx.farmUser.createMany({ data: membershipsToCreate.map((farmId) => ({ farmId, userId: id, role: resultingRole })) });
        }
      }
      if (lotIds !== undefined) {
        const scopedFarmIds = actorFarmIds === null ? null : actorFarmIds;
        await tx.lotUser.deleteMany({
          where: { userId: id, ...(scopedFarmIds === null ? {} : { lot: { farmId: { in: scopedFarmIds } } }) },
        });
        const lotsToCreate = lotIds.length
          ? await tx.lot.findMany({ where: { id: { in: lotIds }, ...(scopedFarmIds === null ? {} : { farmId: { in: scopedFarmIds } }) }, select: { id: true } })
          : [];
        if (lotsToCreate.length) await tx.lotUser.createMany({ data: lotsToCreate.map((lot) => ({ lotId: lot.id, userId: id })) });
      }
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
    if (!user.email) {
      const temporaryPassword = `${randomBytes(16).toString('base64url')}Aa1!`;
      await this.authRequest(`/admin/users/${user.authUserId}`, 'PUT', { password: temporaryPassword });
      await this.prisma.user.update({ where: { id }, data: { passwordChangeRequired: true } });
      await this.audit.record({ userId: actor.appUserId ?? actor.sub, entity: 'User', entityId: id, action: 'PASSWORD_RESET' });
      return { sent: false, temporaryPassword };
    }
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

  async passwordStatus(actor: RequestUser) {
    const user = actor.appUserId
      ? await this.prisma.user.findUnique({ where: { id: actor.appUserId }, select: { passwordChangeRequired: true } })
      : await this.prisma.user.findUnique({ where: { authUserId: actor.sub }, select: { passwordChangeRequired: true } });
    if (!user) throw new NotFoundException('No se encontró el perfil local de la cuenta');
    return { required: user.passwordChangeRequired };
  }

  async changeOwnPassword(password: string, actor: RequestUser) {
    const user = actor.appUserId
      ? await this.prisma.user.findUnique({ where: { id: actor.appUserId }, select: { id: true, authUserId: true, documentNumber: true } })
      : await this.prisma.user.findUnique({ where: { authUserId: actor.sub }, select: { id: true, authUserId: true, documentNumber: true } });
    if (!user?.authUserId) throw new NotFoundException('No se encontró la cuenta en Supabase Auth');
    const digits = password.replace(/\D/g, '');
    if (user.documentNumber && digits && digits === user.documentNumber.replace(/\D/g, '')) {
      throw new BadRequestException('La nueva contraseña debe ser distinta al documento de identidad');
    }
    await this.authRequest(`/admin/users/${user.authUserId}`, 'PUT', { password });
    await this.prisma.user.update({ where: { id: user.id }, data: { passwordChangeRequired: false } });
    return { updated: true };
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
    const farmIds = await this.access.accessibleFarmIds(actor);
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        farmMembers: {
          ...(farmIds === null ? {} : { where: { farmId: { in: farmIds } } }),
          include: { farm: { select: { id: true, name: true } } },
        },
        ownedFarms: {
          ...(farmIds === null ? {} : { where: { id: { in: farmIds } } }),
          select: { id: true, name: true },
        },
        lotMembers: {
          ...(farmIds === null ? {} : { where: { lot: { farmId: { in: farmIds } } } }),
          select: { lot: { select: { id: true, name: true, farmId: true } } },
        },
      },
    });
  }

  private async assertCanManage(id: string, actor: RequestUser) {
    const user = await this.prisma.user.findUnique({ where: { id }, include: { farmMembers: { select: { farmId: true } }, ownedFarms: { select: { id: true } }, lotMembers: { select: { lot: { select: { farmId: true } } } } } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (actor.role === AppRole.ADMIN_CUMBRES) return user;
    if (user.role === AppRole.ADMIN_CUMBRES) throw new ForbiddenException('Un administrador de finca no puede administrar usuarios de Cumbres Sacras');
    const actorFarms = await this.access.accessibleFarmIds(actor);
    const userFarms = [...user.farmMembers.map((m) => m.farmId), ...user.ownedFarms.map((f) => f.id), ...user.lotMembers.map((m) => m.lot.farmId)];
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

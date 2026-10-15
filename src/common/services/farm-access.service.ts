import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestUser } from '../decorators/current-user.decorator';
import { AppRole } from '../enums/app-role.enum';

/**
 * Acceso por finca (ASR-01): la administración de Cumbres ve todas; los demás
 * roles solo las fincas de las que son dueños o miembros. Es la misma regla
 * que aplican las políticas RLS, validada también en el backend.
 */
@Injectable()
export class FarmAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /** Ids de las fincas accesibles, o null si puede ver todas. */
  async accessibleFarmIds(user: RequestUser): Promise<string[] | null> {
    if (user.role === AppRole.ADMIN_CUMBRES) return null;
    if (!user.appUserId) return [];
    const farms = await this.prisma.farm.findMany({
      where: { OR: [{ ownerId: user.appUserId }, { members: { some: { userId: user.appUserId } } }] },
      select: { id: true },
    });
    return farms.map((f) => f.id);
  }

  async assertAccess(user: RequestUser, farmId: string | null | undefined) {
    const ids = await this.accessibleFarmIds(user);
    if (ids === null) return;
    if (!farmId || !ids.includes(farmId)) throw new ForbiddenException('No tienes acceso a esta finca');
  }

  /** Filtro Prisma por finca para listados ({} si puede ver todas). */
  async farmFilter(user: RequestUser): Promise<{ farmId?: { in: string[] } }> {
    const ids = await this.accessibleFarmIds(user);
    return ids === null ? {} : { farmId: { in: ids } };
  }
}

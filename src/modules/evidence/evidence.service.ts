import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EvidenceStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEvidenceDto, ModerateEvidenceDto } from './dto/evidence.dto';
import { AuditService } from '../../common/services/audit.service';
import { FarmAccessService } from '../../common/services/farm-access.service';
import { RequestUser } from '../../common/decorators/current-user.decorator';
import { PUBLIC_EVIDENCE_SELECT } from './public-evidence';
import { ModerationService } from './moderation/moderation.service';

/** Estados que esperan una decisión humana, en el orden de la bandeja. */
export const REVIEW_QUEUE: EvidenceStatus[] = [EvidenceStatus.EN_REVISION, EvidenceStatus.CUARENTENA, EvidenceStatus.PENDIENTE];

@Injectable()
export class EvidenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly moderation: ModerationService,
    private readonly access: FarmAccessService,
  ) {}

  async create(dto: CreateEvidenceDto, user: RequestUser) {
    await this.access.assertAccess(user, dto.farmId);
    const evidence = await this.prisma.evidence.create({ data: dto as never });
    await this.audit.record({ userId: user.appUserId ?? user.sub, entity: 'Evidence', entityId: evidence.id, action: 'CREATE', after: evidence });
    this.moderation.schedule(evidence.id);
    return evidence;
  }

  /** Bandeja de revisión manual, solo de las fincas del usuario: por defecto todo lo que espera decisión humana. */
  async queue(user: RequestUser, statuses: EvidenceStatus[] = REVIEW_QUEUE) {
    return this.prisma.evidence.findMany({
      where: { status: { in: statuses }, ...(await this.access.farmFilter(user)) },
      orderBy: { createdAt: 'asc' },
    });
  }

  async summary(user: RequestUser) {
    const groups = await this.prisma.evidence.groupBy({ by: ['status'], where: await this.access.farmFilter(user), _count: { _all: true } });
    const counts = Object.fromEntries(Object.values(EvidenceStatus).map((s) => [s, 0])) as Record<EvidenceStatus, number>;
    for (const g of groups) counts[g.status] = g._count._all;
    return counts;
  }

  processPending(limit?: number) {
    return this.moderation.processPending(limit);
  }

  async pending(user: RequestUser) {
    return this.queue(user, [EvidenceStatus.PENDIENTE]);
  }

  /**
   * Antes de firmar una URL de descarga: la clave debe ser de una evidencia
   * registrada y de una finca del usuario. Sin esto, cualquier usuario podía
   * descargar cualquier foto del bucket conociendo o adivinando su clave.
   */
  async assertCanDownload(objectKey: string, user: RequestUser) {
    const evidence = await this.prisma.evidence.findFirst({ where: { objectKey }, select: { farmId: true } });
    if (!evidence) throw new NotFoundException('Evidencia no encontrada');
    await this.access.assertAccess(user, evidence.farmId);
  }

  assertCanUpload(farmId: string, user: RequestUser) {
    return this.access.assertAccess(user, farmId);
  }

  async moderate(id: string, dto: ModerateEvidenceDto, user: RequestUser) {
    const current = await this.prisma.evidence.findUnique({ where: { id }, select: { farmId: true } });
    if (!current) throw new NotFoundException('Evidencia no encontrada');
    await this.access.assertAccess(user, current.farmId);
    if (dto.status === EvidenceStatus.RECHAZADA && !dto.rejectionReason?.trim()) {
      throw new BadRequestException('Rechazar una evidencia requiere un motivo');
    }
    if (dto.visibility === 'PUBLICA' && dto.status !== EvidenceStatus.APROBADA) {
      throw new BadRequestException('Solo una evidencia aprobada puede ser pública');
    }
    const evidence = await this.prisma.evidence.update({
      where: { id },
      data: {
        ...dto,
        reviewedById: user.appUserId,
        reviewedAt: new Date(),
      } as never,
    });
    await this.audit.record({ userId: user.appUserId ?? user.sub, entity: 'Evidence', entityId: id, action: `MODERATE_${dto.status}`, after: evidence });
    return evidence;
  }

  findPublic() {
    return this.prisma.evidence.findMany({
      where: { status: 'APROBADA', visibility: 'PUBLICA' },
      orderBy: { createdAt: 'desc' },
      select: PUBLIC_EVIDENCE_SELECT,
    });
  }
}

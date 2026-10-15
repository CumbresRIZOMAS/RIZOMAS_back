import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EvidenceStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEvidenceDto, ModerateEvidenceDto } from './dto/evidence.dto';
import { AuditService } from '../../common/services/audit.service';
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
  ) {}

  async create(dto: CreateEvidenceDto, user: RequestUser) {
    const evidence = await this.prisma.evidence.create({ data: dto as never });
    await this.audit.record({ userId: user.appUserId ?? user.sub, entity: 'Evidence', entityId: evidence.id, action: 'CREATE', after: evidence });
    this.moderation.schedule(evidence.id);
    return evidence;
  }

  /** Bandeja de revisión manual: por defecto todo lo que espera decisión humana. */
  queue(statuses: EvidenceStatus[] = REVIEW_QUEUE) {
    return this.prisma.evidence.findMany({ where: { status: { in: statuses } }, orderBy: { createdAt: 'asc' } });
  }

  async summary() {
    const groups = await this.prisma.evidence.groupBy({ by: ['status'], _count: { _all: true } });
    const counts = Object.fromEntries(Object.values(EvidenceStatus).map((s) => [s, 0])) as Record<EvidenceStatus, number>;
    for (const g of groups) counts[g.status] = g._count._all;
    return counts;
  }

  processPending(limit?: number) {
    return this.moderation.processPending(limit);
  }

  pending() {
    return this.prisma.evidence.findMany({ where: { status: 'PENDIENTE' }, orderBy: { createdAt: 'asc' } });
  }

  async moderate(id: string, dto: ModerateEvidenceDto, user: RequestUser) {
    await this.ensureExists(id);
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

  private async ensureExists(id: string) {
    const evidence = await this.prisma.evidence.findUnique({ where: { id } });
    if (!evidence) throw new NotFoundException('Evidencia no encontrada');
  }
}

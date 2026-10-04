import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEvidenceDto, ModerateEvidenceDto } from './dto/evidence.dto';
import { AuditService } from '../../common/services/audit.service';
import { RequestUser } from '../../common/decorators/current-user.decorator';

@Injectable()
export class EvidenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateEvidenceDto, user: RequestUser) {
    const evidence = await this.prisma.evidence.create({ data: dto as never });
    await this.audit.record({ userId: user.appUserId ?? user.sub, entity: 'Evidence', entityId: evidence.id, action: 'CREATE', after: evidence });
    return evidence;
  }

  pending() {
    return this.prisma.evidence.findMany({ where: { status: 'PENDIENTE' }, orderBy: { createdAt: 'asc' } });
  }

  async moderate(id: string, dto: ModerateEvidenceDto, user: RequestUser) {
    await this.ensureExists(id);
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
    });
  }

  private async ensureExists(id: string) {
    const evidence = await this.prisma.evidence.findUnique({ where: { id } });
    if (!evidence) throw new NotFoundException('Evidencia no encontrada');
  }
}

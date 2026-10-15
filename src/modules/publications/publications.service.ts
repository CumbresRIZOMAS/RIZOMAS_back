import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../common/services/audit.service';
import { RequestUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePublicationDto, PublishPublicationDto } from './dto/publication.dto';
import { PUBLIC_EVIDENCE_SELECT } from '../evidence/public-evidence';
import { publicationForTraceability, toPublicTraceability } from './public-traceability';

@Injectable()
export class PublicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreatePublicationDto, user: RequestUser) {
    if (dto.harvestId) {
      // Integridad (ASR-07): solo se publica una cosecha de la misma finca.
      const harvest = await this.prisma.harvest.findUnique({ where: { id: dto.harvestId }, select: { labor: { select: { farmId: true } } } });
      if (!harvest) throw new NotFoundException('Cosecha no encontrada');
      if (harvest.labor.farmId !== dto.farmId) throw new BadRequestException('La cosecha no pertenece a la finca');
    }
    const publication = await this.prisma.publication.create({ data: dto });
    await this.audit.record({ userId: user.appUserId ?? user.sub, entity: 'Publication', entityId: publication.id, action: 'CREATE', after: publication });
    return publication;
  }

  async publish(id: string, dto: PublishPublicationDto, user: RequestUser) {
    await this.ensureExists(id);
    const publication = await this.prisma.publication.update({
      where: { id },
      data: { active: dto.active, publishedAt: dto.active ? new Date() : null },
    });
    await this.audit.record({ userId: user.appUserId ?? user.sub, entity: 'Publication', entityId: id, action: dto.active ? 'PUBLISH' : 'UNPUBLISH', after: publication });
    return publication;
  }

  findByFarm(farmId: string) {
    return this.prisma.publication.findMany({
      where: { farmId },
      orderBy: { createdAt: 'desc' },
      include: { harvest: { select: { id: true, quantity: true, unit: true, labor: { select: { startDate: true, name: true } } } } },
    });
  }

  findPublished() {
    return this.prisma.publication.findMany({
      where: { active: true },
      orderBy: { publishedAt: 'desc' },
      select: {
        id: true,
        title: true,
        region: true,
        quantity: true,
        unit: true,
        publicLocation: true,
        publishedAt: true,
        evidences: { where: { evidence: { status: 'APROBADA', visibility: 'PUBLICA' } }, select: { evidence: { select: PUBLIC_EVIDENCE_SELECT } } },
      },
    });
  }

  async findOne(id: string) {
    const publication = await this.prisma.publication.findFirst({
      where: { id, active: true },
      select: {
        id: true,
        title: true,
        region: true,
        quantity: true,
        unit: true,
        publicLocation: true,
        publishedAt: true,
        evidences: { where: { evidence: { status: 'APROBADA', visibility: 'PUBLICA' } }, select: { evidence: { select: PUBLIC_EVIDENCE_SELECT } } },
      },
    });
    if (!publication) throw new NotFoundException('Publicación no encontrada');
    return publication;
  }

  /** Trazabilidad pública de una publicación activa (read model, sin datos privados). */
  async publicTraceability(id: string) {
    const row = await this.prisma.publication.findFirst({ where: { id, active: true }, ...publicationForTraceability });
    if (!row) throw new NotFoundException('Publicación no encontrada');
    return toPublicTraceability(row);
  }

  private async ensureExists(id: string) {
    const publication = await this.prisma.publication.findUnique({ where: { id } });
    if (!publication) throw new NotFoundException('Publicación no encontrada');
  }
}

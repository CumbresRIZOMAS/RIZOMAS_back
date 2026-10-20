import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EvidenceStatus, Prisma, Visibility } from '@prisma/client';
import { AuditService } from '../../common/services/audit.service';
import { FarmAccessService } from '../../common/services/farm-access.service';
import { R2Service } from '../../common/storage/r2.service';
import { RequestUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePublicationDto, PublishPublicationDto, SetPublicationEvidencesDto, UpdatePublicationDto } from './dto/publication.dto';
import { PUBLIC_EVIDENCE_SELECT } from '../evidence/public-evidence';
import { publicationForTraceability, toPublicTraceability } from './public-traceability';

/** Una foto sale en el portal solo si se aprobó en moderación y se autorizó como pública. */
const PUBLISHABLE = { status: EvidenceStatus.APROBADA, visibility: Visibility.PUBLICA };

@Injectable()
export class PublicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly access: FarmAccessService,
    private readonly storage: R2Service,
  ) {}

  async create(dto: CreatePublicationDto, user: RequestUser) {
    await this.access.assertAccess(user, dto.farmId);
    if (dto.harvestId) {
      // Integridad (ASR-07): solo se publica una cosecha de la misma finca.
      const harvest = await this.prisma.harvest.findUnique({ where: { id: dto.harvestId }, select: { labor: { select: { farmId: true } } } });
      if (!harvest) throw new NotFoundException('Cosecha no encontrada');
      if (harvest.labor.farmId !== dto.farmId) throw new BadRequestException('La cosecha no pertenece a la finca');
    }
    const publication = await this.prisma.publication.create({
      data: { ...dto, publicLocation: dto.publicLocation as Prisma.InputJsonValue | undefined },
    });
    await this.audit.record({ userId: user.appUserId ?? user.sub, entity: 'Publication', entityId: publication.id, action: 'CREATE', after: publication });
    return publication;
  }

  async update(id: string, dto: UpdatePublicationDto, user: RequestUser) {
    const before = await this.prisma.publication.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Publicación no encontrada');
    await this.access.assertAccess(user, before.farmId);
    if (dto.harvestId) {
      const harvest = await this.prisma.harvest.findUnique({ where: { id: dto.harvestId }, select: { labor: { select: { farmId: true } } } });
      if (!harvest) throw new NotFoundException('Cosecha no encontrada');
      if (harvest.labor.farmId !== before.farmId) throw new BadRequestException('La cosecha no pertenece a la finca');
    }
    const after = await this.prisma.publication.update({ where: { id }, data: dto as never });
    await this.audit.record({ userId: user.appUserId ?? user.sub, entity: 'Publication', entityId: id, action: 'UPDATE_PROFILE', before, after });
    return after;
  }

  async publish(id: string, dto: PublishPublicationDto, user: RequestUser) {
    await this.access.assertAccess(user, (await this.farmOf(id)).farmId);
    const publication = await this.prisma.publication.update({
      where: { id },
      data: { active: dto.active, publishedAt: dto.active ? new Date() : null },
    });
    await this.audit.record({ userId: user.appUserId ?? user.sub, entity: 'Publication', entityId: id, action: dto.active ? 'PUBLISH' : 'UNPUBLISH', after: publication });
    return publication;
  }

  async findByFarm(farmId: string, user: RequestUser) {
    await this.access.assertAccess(user, farmId);
    return this.prisma.publication.findMany({
      where: { farmId },
      orderBy: { createdAt: 'desc' },
      include: {
        harvest: { select: { id: true, quantity: true, unit: true, labor: { select: { startDate: true, name: true } } } },
        evidences: { select: { evidenceId: true } },
      },
    });
  }

  /** Fotos de la finca que se pueden mostrar en la publicación (aprobadas y autorizadas como públicas). */
  async photoCandidates(id: string, user: RequestUser) {
    const { farmId } = await this.farmOf(id);
    await this.access.assertAccess(user, farmId);
    const [candidates, linked] = await Promise.all([
      this.prisma.evidence.findMany({
        where: { farmId, ...PUBLISHABLE },
        orderBy: { capturedAt: 'desc' },
        select: { id: true, objectKey: true, capturedAt: true, laborId: true },
      }),
      this.prisma.publicationEvidence.findMany({ where: { publicationId: id }, select: { evidenceId: true } }),
    ]);
    const ids = new Set(linked.map((l) => l.evidenceId));
    return candidates.map((c) => ({ ...c, linked: ids.has(c.id) }));
  }

  /** Reemplaza las fotos de la publicación. Solo fotos publicables de la misma finca. */
  async setEvidences(id: string, dto: SetPublicationEvidencesDto, user: RequestUser) {
    const { farmId } = await this.farmOf(id);
    await this.access.assertAccess(user, farmId);
    const ids = [...new Set(dto.evidenceIds)];
    const valid = await this.prisma.evidence.count({ where: { id: { in: ids }, farmId, ...PUBLISHABLE } });
    if (valid !== ids.length) {
      throw new BadRequestException('Solo se pueden publicar fotos de esta finca aprobadas y autorizadas como públicas');
    }
    await this.prisma.$transaction([
      this.prisma.publicationEvidence.deleteMany({ where: { publicationId: id } }),
      this.prisma.publicationEvidence.createMany({ data: ids.map((evidenceId) => ({ publicationId: id, evidenceId })) }),
    ]);
    await this.audit.record({ userId: user.appUserId ?? user.sub, entity: 'Publication', entityId: id, action: 'SET_EVIDENCES', after: { evidenceIds: ids } });
    return { evidenceIds: ids };
  }

  /**
   * URL temporal de una foto del portal. El bucket es privado: se firma solo si
   * la publicación está activa y la foto sigue aprobada, pública y asociada.
   */
  async publicPhotoUrl(id: string, evidenceId: string) {
    const link = await this.prisma.publicationEvidence.findFirst({
      where: { publicationId: id, evidenceId, publication: { active: true }, evidence: PUBLISHABLE },
      select: { evidence: { select: { objectKey: true } } },
    });
    if (!link) throw new NotFoundException('Foto no encontrada');
    return (await this.storage.createDownloadUrl(link.evidence.objectKey)).url;
  }

  findPublished() {
    return this.prisma.publication.findMany({
      where: { active: true },
      orderBy: { publishedAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        region: true,
        quantity: true,
        unit: true,
        publicLocation: true,
        publishedAt: true,
        evidences: { where: { evidence: PUBLISHABLE }, select: { evidence: { select: PUBLIC_EVIDENCE_SELECT } } },
      },
    });
  }

  /** Orígenes para el mapa público: muestra una sola publicación representativa por finca. */
  async findPublishedOrigins() {
    const publications = await this.prisma.publication.findMany({
      where: { active: true },
      orderBy: { publishedAt: 'desc' },
      select: {
        id: true,
        farmId: true,
        farm: { select: { municipality: true, region: true } },
        title: true,
        description: true,
        region: true,
        quantity: true,
        unit: true,
        publicLocation: true,
        publishedAt: true,
        evidences: { where: { evidence: PUBLISHABLE }, select: { evidence: { select: PUBLIC_EVIDENCE_SELECT } } },
      },
    });
    const farms = new Set<string>();
    return publications.flatMap(({ farmId, farm, ...publication }) => {
      if (farms.has(farmId)) return [];
      farms.add(farmId);
      return [{
        ...publication,
        municipality: farm.municipality,
        region: publication.region ?? farm.region,
      }];
    });
  }

  async findOne(id: string) {
    const publication = await this.prisma.publication.findFirst({
      where: { id, active: true },
      select: {
        id: true,
        title: true,
        description: true,
        region: true,
        quantity: true,
        unit: true,
        publicLocation: true,
        publishedAt: true,
        evidences: { where: { evidence: PUBLISHABLE }, select: { evidence: { select: PUBLIC_EVIDENCE_SELECT } } },
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

  private async farmOf(id: string) {
    const publication = await this.prisma.publication.findUnique({ where: { id }, select: { farmId: true } });
    if (!publication) throw new NotFoundException('Publicación no encontrada');
    return publication;
  }
}

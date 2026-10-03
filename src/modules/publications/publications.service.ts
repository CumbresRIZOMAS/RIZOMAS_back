import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePublicationDto, PublishPublicationDto } from './dto/publication.dto';

@Injectable()
export class PublicationsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreatePublicationDto) {
    return this.prisma.publication.create({ data: dto });
  }

  async publish(id: string, dto: PublishPublicationDto) {
    await this.ensureExists(id);
    return this.prisma.publication.update({
      where: { id },
      data: { active: dto.active, publishedAt: dto.active ? new Date() : null },
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
        evidences: { where: { evidence: { status: 'APROBADA', visibility: 'PUBLICA' } }, include: { evidence: true } },
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
        evidences: { where: { evidence: { status: 'APROBADA', visibility: 'PUBLICA' } }, include: { evidence: true } },
      },
    });
    if (!publication) throw new NotFoundException('Publicación no encontrada');
    return publication;
  }

  private async ensureExists(id: string) {
    const publication = await this.prisma.publication.findUnique({ where: { id } });
    if (!publication) throw new NotFoundException('Publicación no encontrada');
  }
}

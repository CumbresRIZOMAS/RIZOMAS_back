import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEvidenceDto, ModerateEvidenceDto } from './dto/evidence.dto';

@Injectable()
export class EvidenceService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateEvidenceDto) {
    return this.prisma.evidence.create({ data: dto as never });
  }

  pending() {
    return this.prisma.evidence.findMany({ where: { status: 'PENDIENTE' }, orderBy: { createdAt: 'asc' } });
  }

  async moderate(id: string, dto: ModerateEvidenceDto) {
    await this.ensureExists(id);
    return this.prisma.evidence.update({ where: { id }, data: dto as never });
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

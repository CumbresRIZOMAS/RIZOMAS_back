import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ApplyBioinputDto, CreateBioinputDto } from './dto/bioinput.dto';

@Injectable()
export class BioinputsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateBioinputDto) {
    return this.prisma.bioinput.create({ data: dto as never });
  }

  findAll() {
    return this.prisma.bioinput.findMany({ orderBy: { createdAt: 'desc' } });
  }

  apply(dto: ApplyBioinputDto) {
    return this.prisma.bioinputApplication.create({
      data: dto,
      include: { bioinput: true, lot: true, labor: true },
    });
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateIndicatorDto, CreateIndicatorValueDto } from './dto/indicator.dto';

@Injectable()
export class IndicatorsService {
  constructor(private readonly prisma: PrismaService) {}

  createDefinition(dto: CreateIndicatorDto) {
    return this.prisma.indicatorDefinition.create({ data: dto });
  }

  createValue(dto: CreateIndicatorValueDto) {
    return this.prisma.indicatorValue.create({ data: dto });
  }

  findByFarm(farmId: string) {
    return this.prisma.indicatorValue.findMany({
      where: { farmId },
      orderBy: { createdAt: 'desc' },
      include: { definition: true, lot: true },
    });
  }
}

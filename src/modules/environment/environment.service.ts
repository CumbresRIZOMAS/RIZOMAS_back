import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEnvironmentalConditionDto } from './dto/environment.dto';

@Injectable()
export class EnvironmentService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateEnvironmentalConditionDto) {
    return this.prisma.environmentalCondition.create({ data: dto });
  }

  findByFarm(farmId: string, lotId?: string) {
    return this.prisma.environmentalCondition.findMany({
      where: { farmId, ...(lotId ? { lotId } : {}) },
      orderBy: { observedAt: 'desc' },
    });
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCoffeeProcessDto } from './dto/coffee.dto';

@Injectable()
export class CoffeeService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateCoffeeProcessDto) {
    return this.prisma.coffeeProcess.create({ data: dto });
  }

  findByFarm(farmId: string) {
    return this.prisma.coffeeProcess.findMany({
      where: { farmId },
      orderBy: { startedAt: 'desc' },
      include: { harvest: true, products: true },
    });
  }
}

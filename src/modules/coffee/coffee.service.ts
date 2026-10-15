import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { RequestUser } from '../../common/decorators/current-user.decorator';
import { CreateCertificationDto, CreateCoffeeProcessDto, CreateProductFinalDto, UpdateCoffeeProcessDto } from './dto/coffee.dto';

const processInclude = { harvest: true, products: { include: { certifications: true } } } as const;

/** Procesos de café (RF-14): cosecha → beneficio → … → producto final con certificaciones. */
@Injectable()
export class CoffeeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateCoffeeProcessDto, user: RequestUser) {
    if (dto.harvestId) {
      // Integridad (ASR-07): la cosecha de origen debe ser de la misma finca.
      const harvest = await this.prisma.harvest.findUnique({ where: { id: dto.harvestId }, select: { labor: { select: { farmId: true } } } });
      if (!harvest) throw new NotFoundException('Cosecha no encontrada');
      if (harvest.labor.farmId !== dto.farmId) throw new BadRequestException('La cosecha no pertenece a la finca del proceso');
    }
    const process = await this.prisma.coffeeProcess.create({ data: dto, include: processInclude });
    await this.audit.record({ userId: user.appUserId ?? user.sub, entity: 'CoffeeProcess', entityId: process.id, action: 'CREATE', after: process });
    return process;
  }

  findByFarm(farmId: string) {
    return this.prisma.coffeeProcess.findMany({
      where: { farmId },
      orderBy: { startedAt: 'desc' },
      include: processInclude,
    });
  }

  async findOne(id: string) {
    const process = await this.prisma.coffeeProcess.findUnique({ where: { id }, include: processInclude });
    if (!process) throw new NotFoundException('Proceso no encontrado');
    return process;
  }

  /** Avanza la etapa, agrega notas o cierra el proceso. */
  async update(id: string, dto: UpdateCoffeeProcessDto, user: RequestUser) {
    const before = await this.findOne(id);
    if (dto.finishedAt && dto.finishedAt < before.startedAt) throw new BadRequestException('El proceso no puede terminar antes de empezar');
    const after = await this.prisma.coffeeProcess.update({ where: { id }, data: dto, include: processInclude });
    await this.audit.record({ userId: user.appUserId ?? user.sub, entity: 'CoffeeProcess', entityId: id, action: 'UPDATE', before, after });
    return after;
  }

  async addProduct(processId: string, dto: CreateProductFinalDto, user: RequestUser) {
    const process = await this.findOne(processId);
    const product = await this.prisma.productFinal.create({
      data: { ...dto, coffeeProcessId: processId, harvestId: process.harvestId },
      include: { certifications: true },
    });
    await this.audit.record({ userId: user.appUserId ?? user.sub, entity: 'ProductFinal', entityId: product.id, action: 'CREATE', after: product });
    return product;
  }

  async addCertification(productId: string, dto: CreateCertificationDto, user: RequestUser) {
    const product = await this.prisma.productFinal.findUnique({ where: { id: productId }, select: { id: true } });
    if (!product) throw new NotFoundException('Producto final no encontrado');
    const certification = await this.prisma.certification.create({ data: { ...dto, productFinalId: productId } });
    await this.audit.record({ userId: user.appUserId ?? user.sub, entity: 'Certification', entityId: certification.id, action: 'CREATE', after: certification });
    return certification;
  }
}

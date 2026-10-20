import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { FarmAccessService } from '../../common/services/farm-access.service';
import { RequestUser } from '../../common/decorators/current-user.decorator';
import { CreateCertificationDto, CreateCoffeeProcessDto, CreateCoffeeProcessEventDto, CreateProductFinalDto, UpdateCoffeeProcessDto } from './dto/coffee.dto';

const processInclude = { harvest: true, lot: { include: { crops: true } }, events: { orderBy: { recordedAt: 'asc' as const } }, products: { include: { certifications: true } } } as const;

/** Procesos de café (RF-14): cosecha → beneficio → … → producto final con certificaciones. */
@Injectable()
export class CoffeeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly access: FarmAccessService,
  ) {}

  async create(dto: CreateCoffeeProcessDto, user: RequestUser) {
    await this.access.assertAccess(user, dto.farmId);
    if (dto.harvestId) {
      // Integridad (ASR-07): la cosecha de origen debe ser de la misma finca.
      const harvest = await this.prisma.harvest.findUnique({ where: { id: dto.harvestId }, select: { labor: { select: { farmId: true } } } });
      if (!harvest) throw new NotFoundException('Cosecha no encontrada');
      if (harvest.labor.farmId !== dto.farmId) throw new BadRequestException('La cosecha no pertenece a la finca del proceso');
    }
    if (dto.lotId) {
      const lot = await this.prisma.lot.findUnique({ where: { id: dto.lotId }, select: { farmId: true } });
      if (!lot) throw new NotFoundException('Lote no encontrado');
      if (lot.farmId !== dto.farmId) throw new BadRequestException('El lote no pertenece a la finca del proceso');
      if (dto.harvestId) {
        const harvest = await this.prisma.harvest.findUnique({ where: { id: dto.harvestId }, select: { crop: { select: { lotId: true } }, labor: { select: { lotId: true } } } });
        const harvestLotId = harvest?.crop?.lotId ?? harvest?.labor.lotId;
        if (harvestLotId && harvestLotId !== dto.lotId) throw new BadRequestException('La cosecha no pertenece al lote del proceso');
      }
    }
    const process = await this.prisma.coffeeProcess.create({ data: dto, include: processInclude });
    await this.audit.record({ userId: user.appUserId ?? user.sub, entity: 'CoffeeProcess', entityId: process.id, action: 'CREATE', after: process });
    return process;
  }

  async addEvent(processId: string, dto: CreateCoffeeProcessEventDto, user: RequestUser) {
    const process = await this.findOne(processId, user);
    const event = await this.prisma.$transaction(async (tx) => {
      const created = await tx.coffeeProcessEvent.create({ data: { ...dto, coffeeProcessId: processId } });
      await tx.coffeeProcess.update({ where: { id: processId }, data: { currentStage: dto.stage } });
      return created;
    });
    await this.audit.record({ userId: user.appUserId ?? user.sub, entity: 'CoffeeProcessEvent', entityId: event.id, action: 'CREATE', after: event });
    // El proceso apunta siempre a la última etapa registrada.
    return { ...process, currentStage: dto.stage, events: [...(process.events ?? []), event] };
  }

  async findByFarm(farmId: string, user: RequestUser) {
    await this.access.assertAccess(user, farmId);
    return this.prisma.coffeeProcess.findMany({
      where: { farmId },
      orderBy: { startedAt: 'desc' },
      include: processInclude,
    });
  }

  async findOne(id: string, user: RequestUser) {
    const process = await this.prisma.coffeeProcess.findUnique({ where: { id }, include: processInclude });
    if (!process) throw new NotFoundException('Proceso no encontrado');
    await this.access.assertAccess(user, process.farmId);
    return process;
  }

  /** Avanza la etapa, agrega notas o cierra el proceso. */
  async update(id: string, dto: UpdateCoffeeProcessDto, user: RequestUser) {
    const before = await this.findOne(id, user);
    if (dto.finishedAt && dto.finishedAt < before.startedAt) throw new BadRequestException('El proceso no puede terminar antes de empezar');
    const after = await this.prisma.coffeeProcess.update({ where: { id }, data: dto, include: processInclude });
    await this.audit.record({ userId: user.appUserId ?? user.sub, entity: 'CoffeeProcess', entityId: id, action: 'UPDATE', before, after });
    return after;
  }

  async addProduct(processId: string, dto: CreateProductFinalDto, user: RequestUser) {
    const process = await this.findOne(processId, user);
    const product = await this.prisma.productFinal.create({
      data: { ...dto, coffeeProcessId: processId, harvestId: process.harvestId },
      include: { certifications: true },
    });
    await this.audit.record({ userId: user.appUserId ?? user.sub, entity: 'ProductFinal', entityId: product.id, action: 'CREATE', after: product });
    return product;
  }

  async addCertification(productId: string, dto: CreateCertificationDto, user: RequestUser) {
    const product = await this.prisma.productFinal.findUnique({ where: { id: productId }, select: { id: true, coffeeProcess: { select: { farmId: true } } } });
    if (!product) throw new NotFoundException('Producto final no encontrado');
    await this.access.assertAccess(user, product.coffeeProcess.farmId);
    const certification = await this.prisma.certification.create({ data: { ...dto, productFinalId: productId } });
    await this.audit.record({ userId: user.appUserId ?? user.sub, entity: 'Certification', entityId: certification.id, action: 'CREATE', after: certification });
    return certification;
  }
}

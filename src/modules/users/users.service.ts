import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AddFarmMemberDto, CreateUserDto, UpdateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateUserDto) {
    return this.prisma.user.create({ data: dto });
  }

  findAll() {
    return this.prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.ensureExists(id);
    return this.prisma.user.update({ where: { id }, data: dto });
  }

  async setStatus(id: string, active: boolean) {
    await this.ensureExists(id);
    return this.prisma.user.update({ where: { id }, data: { active } });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { farmMembers: { include: { farm: true } }, ownedFarms: true },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  addFarmMember(farmId: string, dto: AddFarmMemberDto) {
    return this.prisma.farmUser.upsert({
      where: { farmId_userId: { farmId, userId: dto.userId } },
      update: { role: dto.role },
      create: { farmId, userId: dto.userId, role: dto.role },
    });
  }

  private async ensureExists(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
  }
}

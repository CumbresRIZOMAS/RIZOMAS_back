import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: {
    userId?: string;
    entity: string;
    entityId?: string;
    action: string;
    before?: unknown;
    after?: unknown;
  }) {
    return this.prisma.auditLog.create({ data: input as never });
  }
}

import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

function toAuditJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

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
    const user = input.userId
      ? await this.prisma.user.findFirst({
          where: { OR: [{ id: input.userId }, { authUserId: input.userId }] },
          select: { id: true },
        })
      : null;

    return this.prisma.auditLog.create({
      data: {
        entity: input.entity,
        entityId: input.entityId,
        action: input.action,
        before: toAuditJson(input.before),
        after: toAuditJson(input.after),
        userId: user?.id,
      },
    });
  }
}

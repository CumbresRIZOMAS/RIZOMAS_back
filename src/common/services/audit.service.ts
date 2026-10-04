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
        before: input.before as never,
        after: input.after as never,
        userId: user?.id,
      },
    });
  }
}

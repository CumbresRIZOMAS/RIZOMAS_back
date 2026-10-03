import { Global, Module } from '@nestjs/common';
import { AuditService } from '../common/services/audit.service';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService, AuditService],
  exports: [PrismaService, AuditService],
})
export class PrismaModule {}

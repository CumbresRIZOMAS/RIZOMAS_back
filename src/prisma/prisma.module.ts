import { Global, Module } from '@nestjs/common';
import { AuditService } from '../common/services/audit.service';
import { FarmAccessService } from '../common/services/farm-access.service';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService, AuditService, FarmAccessService],
  exports: [PrismaService, AuditService, FarmAccessService],
})
export class PrismaModule {}

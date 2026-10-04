import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AuthGuard } from './common/guards/auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './modules/users/users.module';
import { FarmsModule } from './modules/farms/farms.module';
import { LotsModule } from './modules/lots/lots.module';
import { CropsModule } from './modules/crops/crops.module';
import { LaborsModule } from './modules/labors/labors.module';
import { SoilModule } from './modules/soil/soil.module';
import { EvidenceModule } from './modules/evidence/evidence.module';
import { TraceabilityModule } from './modules/traceability/traceability.module';
import { ReportsModule } from './modules/reports/reports.module';
import { SyncModule } from './modules/sync/sync.module';
import { BioinputsModule } from './modules/bioinputs/bioinputs.module';
import { CoffeeModule } from './modules/coffee/coffee.module';
import { CommercialModule } from './modules/commercial/commercial.module';
import { CyclesModule } from './modules/cycles/cycles.module';
import { EnvironmentModule } from './modules/environment/environment.module';
import { IndicatorsModule } from './modules/indicators/indicators.module';
import { PublicationsModule } from './modules/publications/publications.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.register({ global: true }),
    PrismaModule,
    UsersModule,
    FarmsModule,
    LotsModule,
    CropsModule,
    LaborsModule,
    SoilModule,
    EvidenceModule,
    BioinputsModule,
    CoffeeModule,
    CommercialModule,
    CyclesModule,
    EnvironmentModule,
    IndicatorsModule,
    PublicationsModule,
    TraceabilityModule,
    ReportsModule,
    SyncModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  controllers: [HealthController],
})
export class AppModule {}

import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AppRole } from '../../common/enums/app-role.enum';
import { SyncBatchDto } from './dto/sync.dto';
import { SyncService } from './sync.service';

@Controller('sync')
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @Roles(AppRole.ADMIN_CUMBRES, AppRole.ADMIN_FINCA, AppRole.TECNICO, AppRole.AGRICULTOR)
  @Post('batch')
  applyBatch(@Body() dto: SyncBatchDto, @CurrentUser() user: RequestUser) {
    return this.sync.applyBatch(dto, user);
  }

  @Roles(AppRole.ADMIN_CUMBRES, AppRole.ADMIN_FINCA, AppRole.TECNICO, AppRole.AGRICULTOR, AppRole.PROVEEDOR, AppRole.COMPRADOR_CERTIFICADORA, AppRole.CLIENTE, AppRole.PUBLICO)
  @Get('pull')
  pull(@Query('since') since: string | undefined, @CurrentUser() user: RequestUser) {
    return this.sync.pull(since, user);
  }
}

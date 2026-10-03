import { Body, Controller, Post } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { AppRole } from '../../common/enums/app-role.enum';
import { SyncBatchDto } from './dto/sync.dto';
import { SyncService } from './sync.service';

@Controller('sync')
@Roles(AppRole.ADMIN_FINCA, AppRole.TECNICO, AppRole.AGRICULTOR)
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @Post('batch')
  applyBatch(@Body() dto: SyncBatchDto) {
    return this.sync.applyBatch(dto);
  }
}

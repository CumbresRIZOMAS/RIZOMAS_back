import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { AppRole } from '../../common/enums/app-role.enum';
import { ReportQueryDto } from './dto/report-query.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
@Roles(AppRole.ADMIN_CUMBRES, AppRole.ADMIN_FINCA, AppRole.TECNICO)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('production')
  production(@Query() query: ReportQueryDto) {
    return this.reports.production(query);
  }
}

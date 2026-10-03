import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { AppRole } from '../../common/enums/app-role.enum';
import { CommercialService } from './commercial.service';
import { CreatePurchaseDto, CreateSaleDto } from './dto/commercial.dto';

@Controller('commercial')
@Roles(AppRole.ADMIN_CUMBRES, AppRole.ADMIN_FINCA)
export class CommercialController {
  constructor(private readonly commercial: CommercialService) {}

  @Post('purchases')
  createPurchase(@Body() dto: CreatePurchaseDto) {
    return this.commercial.createPurchase(dto);
  }

  @Post('sales')
  createSale(@Body() dto: CreateSaleDto) {
    return this.commercial.createSale(dto);
  }

  @Get('farms/:farmId/ledger')
  ledger(@Param('farmId') farmId: string) {
    return this.commercial.ledger(farmId);
  }
}

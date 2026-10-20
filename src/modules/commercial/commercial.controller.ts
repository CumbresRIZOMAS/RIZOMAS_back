import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { AppRole } from '../../common/enums/app-role.enum';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { CommercialService } from './commercial.service';
import { CreatePurchaseDto, CreateSaleDto } from './dto/commercial.dto';

@Controller('commercial')
@Roles(AppRole.ADMIN_CUMBRES, AppRole.ADMIN_FINCA)
export class CommercialController {
  constructor(private readonly commercial: CommercialService) {}

  @Post('purchases')
  createPurchase(@Body() dto: CreatePurchaseDto, @CurrentUser() user: RequestUser) {
    return this.commercial.createPurchase(dto, user);
  }

  @Post('sales')
  createSale(@Body() dto: CreateSaleDto, @CurrentUser() user: RequestUser) {
    return this.commercial.createSale(dto, user);
  }

  @Get('suppliers')
  suppliers() {
    return this.commercial.suppliers();
  }

  @Get('farms/:farmId/ledger')
  ledger(@Param('farmId') farmId: string, @CurrentUser() user: RequestUser) {
    return this.commercial.ledger(farmId, user);
  }
}

import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { AppRole } from '../../common/enums/app-role.enum';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { CreateCertificationDto, CreateCoffeeProcessDto, CreateProductFinalDto, UpdateCoffeeProcessDto } from './dto/coffee.dto';
import { CoffeeService } from './coffee.service';

@Controller('coffee-processes')
@Roles(AppRole.ADMIN_CUMBRES, AppRole.ADMIN_FINCA, AppRole.TECNICO, AppRole.AGRICULTOR)
export class CoffeeController {
  constructor(private readonly coffee: CoffeeService) {}

  @Post()
  create(@Body() dto: CreateCoffeeProcessDto, @CurrentUser() user: RequestUser) {
    return this.coffee.create(dto, user);
  }

  @Get('farms/:farmId')
  findByFarm(@Param('farmId', ParseUUIDPipe) farmId: string) {
    return this.coffee.findByFarm(farmId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.coffee.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCoffeeProcessDto, @CurrentUser() user: RequestUser) {
    return this.coffee.update(id, dto, user);
  }

  @Post(':id/products')
  addProduct(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateProductFinalDto, @CurrentUser() user: RequestUser) {
    return this.coffee.addProduct(id, dto, user);
  }

  /** Certificar un producto es decisión técnica o administrativa, no del agricultor. */
  @Post('products/:productId/certifications')
  @Roles(AppRole.ADMIN_CUMBRES, AppRole.ADMIN_FINCA, AppRole.TECNICO)
  addCertification(@Param('productId', ParseUUIDPipe) productId: string, @Body() dto: CreateCertificationDto, @CurrentUser() user: RequestUser) {
    return this.coffee.addCertification(productId, dto, user);
  }
}

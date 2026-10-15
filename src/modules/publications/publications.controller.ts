import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AppRole } from '../../common/enums/app-role.enum';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { PublicationsService } from './publications.service';
import { CreatePublicationDto, PublishPublicationDto } from './dto/publication.dto';

/** Quienes deciden qué se publica en el portal (RF-18). */
const EDITORES = [AppRole.ADMIN_CUMBRES, AppRole.ADMIN_FINCA, AppRole.TECNICO];

@Controller('publications')
export class PublicationsController {
  constructor(private readonly publications: PublicationsService) {}

  @Post()
  @Roles(...EDITORES)
  create(@Body() dto: CreatePublicationDto, @CurrentUser() user: RequestUser) {
    return this.publications.create(dto, user);
  }

  @Patch(':id/status')
  @Roles(...EDITORES)
  publish(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PublishPublicationDto, @CurrentUser() user: RequestUser) {
    return this.publications.publish(id, dto, user);
  }

  /** Todas las publicaciones de una finca, activas o no, para gestionarlas desde el panel. */
  @Get('farms/:farmId')
  @Roles(...EDITORES)
  findByFarm(@Param('farmId', ParseUUIDPipe) farmId: string) {
    return this.publications.findByFarm(farmId);
  }

  @Public()
  @Get()
  findPublished() {
    return this.publications.findPublished();
  }

  @Public()
  @Get(':id/traceability')
  traceability(@Param('id', ParseUUIDPipe) id: string) {
    return this.publications.publicTraceability(id);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.publications.findOne(id);
  }
}

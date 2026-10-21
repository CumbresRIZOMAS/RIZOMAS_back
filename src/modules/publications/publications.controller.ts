import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Patch, Post, Put, Redirect } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AppRole } from '../../common/enums/app-role.enum';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { PublicationsService } from './publications.service';
import { CreatePublicationDto, PublishPublicationDto, SetPublicationEvidencesDto, UpdatePublicationDto } from './dto/publication.dto';

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

  @Patch(':id')
  @Roles(...EDITORES)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePublicationDto, @CurrentUser() user: RequestUser) {
    return this.publications.update(id, dto, user);
  }

  @Patch(':id/status')
  @Roles(...EDITORES)
  publish(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PublishPublicationDto, @CurrentUser() user: RequestUser) {
    return this.publications.publish(id, dto, user);
  }

  /** Todas las publicaciones de una finca, activas o no, para gestionarlas desde el panel. */
  @Get('farms/:farmId')
  @Roles(...EDITORES)
  findByFarm(@Param('farmId', ParseUUIDPipe) farmId: string, @CurrentUser() user: RequestUser) {
    return this.publications.findByFarm(farmId, user);
  }

  @Get(':id/photo-candidates')
  @Roles(...EDITORES)
  photoCandidates(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.publications.photoCandidates(id, user);
  }

  @Put(':id/evidences')
  @Roles(...EDITORES)
  setEvidences(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetPublicationEvidencesDto, @CurrentUser() user: RequestUser) {
    return this.publications.setEvidences(id, dto, user);
  }

  /** Foto del portal: redirige a una URL firmada de corta duración (el bucket es privado). */
  @Public()
  @Get(':id/photos/:evidenceId')
  @Redirect()
  @Header('Cache-Control', 'no-store')
  async photo(@Param('id', ParseUUIDPipe) id: string, @Param('evidenceId', ParseUUIDPipe) evidenceId: string) {
    return { url: await this.publications.publicPhotoUrl(id, evidenceId), statusCode: 302 };
  }

  @Public()
  @Get()
  findPublished() {
    return this.publications.findPublished();
  }

  /** Una entrada por finca con al menos una publicación activa, sin exponer el id de la finca. */
  @Public()
  @Get('origins')
  findPublishedOrigins() {
    return this.publications.findPublishedOrigins();
  }

  @Public()
  @Get(':id/traceability')
  traceability(@Param('id', ParseUUIDPipe) id: string) {
    return this.publications.publicTraceability(id);
  }

  @Public()
  @Get('farms/:farmId/traceability')
  traceabilityByFarm(@Param('farmId', ParseUUIDPipe) farmId: string) {
    return this.publications.publicFarmTraceability(farmId);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.publications.findOne(id);
  }
}

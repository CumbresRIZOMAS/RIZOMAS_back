import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { EvidenceStatus } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AppRole } from '../../common/enums/app-role.enum';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { CreateEvidenceDto, ModerateEvidenceDto } from './dto/evidence.dto';
import { CreateEvidenceDownloadUrlDto, CreateEvidenceUploadUrlDto } from './dto/evidence-storage.dto';
import { EvidenceService } from './evidence.service';
import { R2Service } from '../../common/storage/r2.service';

@Controller('evidence')
export class EvidenceController {
  constructor(
    private readonly evidence: EvidenceService,
    private readonly storage: R2Service,
  ) {}

  @Post('upload-url')
  @Roles(AppRole.ADMIN_CUMBRES, AppRole.ADMIN_FINCA, AppRole.TECNICO, AppRole.AGRICULTOR)
  async createUploadUrl(@Body() dto: CreateEvidenceUploadUrlDto, @CurrentUser() user: RequestUser) {
    await this.evidence.assertCanUpload(dto.farmId, user);
    const objectKey = `farms/${dto.farmId}/evidence/${crypto.randomUUID()}-${dto.fileName}`;
    return this.storage.createUploadUrl(objectKey, dto.contentType);
  }

  @Post('download-url')
  @Roles(AppRole.ADMIN_CUMBRES, AppRole.ADMIN_FINCA, AppRole.TECNICO, AppRole.AGRICULTOR)
  async createDownloadUrl(@Body() dto: CreateEvidenceDownloadUrlDto, @CurrentUser() user: RequestUser) {
    await this.evidence.assertCanDownload(dto.objectKey, user);
    return this.storage.createDownloadUrl(dto.objectKey);
  }

  @Post()
  @Roles(AppRole.ADMIN_CUMBRES, AppRole.ADMIN_FINCA, AppRole.TECNICO, AppRole.AGRICULTOR)
  create(@Body() dto: CreateEvidenceDto, @CurrentUser() user: RequestUser) {
    return this.evidence.create(dto, user);
  }

  /** Bandeja de revisión. ?status=EN_REVISION,CUARENTENA filtra; sin filtro trae todo lo que espera decisión. */
  @Get('moderation')
  @Roles(AppRole.ADMIN_CUMBRES, AppRole.ADMIN_FINCA, AppRole.TECNICO)
  queue(@CurrentUser() user: RequestUser, @Query('status') status?: string) {
    if (!status) return this.evidence.queue(user);
    const statuses = status.split(',').map((s) => s.trim());
    const invalid = statuses.filter((s) => !(s in EvidenceStatus));
    if (invalid.length) throw new BadRequestException(`Estado no válido: ${invalid.join(', ')}`);
    return this.evidence.queue(user, statuses as EvidenceStatus[]);
  }

  @Get('moderation/summary')
  @Roles(AppRole.ADMIN_CUMBRES, AppRole.ADMIN_FINCA, AppRole.TECNICO)
  summary(@CurrentUser() user: RequestUser) {
    return this.evidence.summary(user);
  }

  /** Reintenta la moderación automática de las evidencias que quedaron PENDIENTE. */
  @Post('moderation/process')
  @Roles(AppRole.ADMIN_CUMBRES, AppRole.TECNICO)
  processPending() {
    return this.evidence.processPending();
  }

  @Get('moderation/pending')
  @Roles(AppRole.ADMIN_CUMBRES, AppRole.ADMIN_FINCA, AppRole.TECNICO)
  pending(@CurrentUser() user: RequestUser) {
    return this.evidence.pending(user);
  }

  @Patch(':id/moderation')
  @Roles(AppRole.ADMIN_CUMBRES, AppRole.ADMIN_FINCA, AppRole.TECNICO)
  moderate(@Param('id') id: string, @Body() dto: ModerateEvidenceDto, @CurrentUser() user: RequestUser) {
    return this.evidence.moderate(id, dto, user);
  }

  @Public()
  @Get('public')
  findPublic() {
    return this.evidence.findPublic();
  }
}

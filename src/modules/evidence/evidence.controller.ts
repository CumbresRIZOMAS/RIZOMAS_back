import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
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
  createUploadUrl(@Body() dto: CreateEvidenceUploadUrlDto) {
    const objectKey = `farms/${dto.farmId}/evidence/${crypto.randomUUID()}-${dto.fileName}`;
    return this.storage.createUploadUrl(objectKey, dto.contentType);
  }

  @Post('download-url')
  @Roles(AppRole.ADMIN_CUMBRES, AppRole.ADMIN_FINCA, AppRole.TECNICO, AppRole.AGRICULTOR)
  createDownloadUrl(@Body() dto: CreateEvidenceDownloadUrlDto) {
    return this.storage.createDownloadUrl(dto.objectKey);
  }

  @Post()
  @Roles(AppRole.ADMIN_CUMBRES, AppRole.ADMIN_FINCA, AppRole.TECNICO, AppRole.AGRICULTOR)
  create(@Body() dto: CreateEvidenceDto, @CurrentUser() user: RequestUser) {
    return this.evidence.create(dto, user);
  }

  @Get('moderation/pending')
  @Roles(AppRole.ADMIN_CUMBRES, AppRole.ADMIN_FINCA, AppRole.TECNICO)
  pending() {
    return this.evidence.pending();
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

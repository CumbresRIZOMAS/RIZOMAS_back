import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AppRole } from '../../common/enums/app-role.enum';
import { CreateEvidenceDto, ModerateEvidenceDto } from './dto/evidence.dto';
import { EvidenceService } from './evidence.service';

@Controller('evidence')
export class EvidenceController {
  constructor(private readonly evidence: EvidenceService) {}

  @Post()
  @Roles(AppRole.ADMIN_CUMBRES, AppRole.ADMIN_FINCA, AppRole.TECNICO, AppRole.AGRICULTOR)
  create(@Body() dto: CreateEvidenceDto) {
    return this.evidence.create(dto);
  }

  @Get('moderation/pending')
  @Roles(AppRole.ADMIN_CUMBRES, AppRole.ADMIN_FINCA, AppRole.TECNICO)
  pending() {
    return this.evidence.pending();
  }

  @Patch(':id/moderation')
  @Roles(AppRole.ADMIN_CUMBRES, AppRole.ADMIN_FINCA, AppRole.TECNICO)
  moderate(@Param('id') id: string, @Body() dto: ModerateEvidenceDto) {
    return this.evidence.moderate(id, dto);
  }

  @Public()
  @Get('public')
  findPublic() {
    return this.evidence.findPublic();
  }
}

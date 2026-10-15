import { Module } from '@nestjs/common';
import { EvidenceController } from './evidence.controller';
import { EvidenceService } from './evidence.service';
import { GoogleVisionAdapter } from './moderation/google-vision.adapter';
import { PRIMARY_MODERATION, SECONDARY_MODERATION } from './moderation/moderation.port';
import { ModerationService } from './moderation/moderation.service';
import { NsfwjsAdapter } from './moderation/nsfwjs.adapter';

@Module({
  controllers: [EvidenceController],
  providers: [
    EvidenceService,
    ModerationService,
    { provide: PRIMARY_MODERATION, useClass: NsfwjsAdapter },
    { provide: SECONDARY_MODERATION, useClass: GoogleVisionAdapter },
  ],
  exports: [EvidenceService],
})
export class EvidenceModule {}

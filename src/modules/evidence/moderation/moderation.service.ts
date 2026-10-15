import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EvidenceStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { R2Service } from '../../../common/storage/r2.service';
import { AuditService } from '../../../common/services/audit.service';
import { ImageModerationAdapter, PRIMARY_MODERATION, SECONDARY_MODERATION } from './moderation.port';

export type Thresholds = { quarantine: number; ambiguous: number };

/**
 * Estado tras la moderación automática. Ninguna foto se aprueba sola: lo que
 * pasa el filtro queda EN_REVISION para la revisión manual; lo sospechoso va a
 * CUARENTENA (oculta hasta que un revisor decida).
 */
export function decideStatus(score: number, thresholds: Thresholds): EvidenceStatus {
  return score >= thresholds.quarantine ? EvidenceStatus.CUARENTENA : EvidenceStatus.EN_REVISION;
}

@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: R2Service,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    @Inject(PRIMARY_MODERATION) private readonly primary: ImageModerationAdapter,
    @Inject(SECONDARY_MODERATION) private readonly secondary: ImageModerationAdapter,
  ) {}

  /**
   * Lanza la moderación sin bloquear la respuesta: registrar la evidencia debe
   * confirmarse rápido (ASR-03). Si el proceso se cae, la foto sigue PENDIENTE
   * y se recupera con processPending.
   */
  schedule(evidenceId: string) {
    setImmediate(() => {
      this.process(evidenceId).catch((error: unknown) => this.logger.error(`Moderación de ${evidenceId} falló`, error as Error));
    });
  }

  async process(evidenceId: string) {
    const evidence = await this.prisma.evidence.findUnique({ where: { id: evidenceId }, select: { id: true, status: true, objectKey: true } });
    if (!evidence || evidence.status !== EvidenceStatus.PENDIENTE) return null;

    const thresholds = this.thresholds();
    const detail: Record<string, unknown> = {};
    const engines: string[] = [];
    let score: number;
    try {
      const { body } = await this.storage.getObject(evidence.objectKey);
      const primary = await this.primary.classify(body);
      detail[this.primary.name] = primary.labels;
      engines.push(this.primary.name);
      score = primary.score;

      if (this.secondary.isEnabled() && score >= thresholds.ambiguous && score < thresholds.quarantine) {
        try {
          const secondary = await this.secondary.classify(body);
          detail[this.secondary.name] = secondary.labels;
          engines.push(this.secondary.name);
          score = Math.max(score, secondary.score);
        } catch (error) {
          detail[`${this.secondary.name}_error`] = (error as Error).message;
        }
      }
    } catch (error) {
      // Sin foto o sin poder leerla no hay decisión automática: sigue PENDIENTE para revisión.
      await this.prisma.evidence.updateMany({
        where: { id: evidence.id, status: EvidenceStatus.PENDIENTE },
        data: { moderation: { error: (error as Error).message, attemptedAt: new Date().toISOString() } },
      });
      this.logger.warn(`No se pudo moderar ${evidence.id}: ${(error as Error).message}`);
      return null;
    }

    const status = decideStatus(score, thresholds);
    // updateMany con status PENDIENTE: no pisa una decisión manual tomada mientras corría el modelo.
    const { count } = await this.prisma.evidence.updateMany({
      where: { id: evidence.id, status: EvidenceStatus.PENDIENTE },
      data: {
        status,
        moderationScore: Math.round(score * 10_000) / 10_000,
        moderationEngine: engines.join('+'),
        moderation: { ...detail, processedAt: new Date().toISOString() } as never,
      },
    });
    if (count === 0) return null;
    await this.audit.record({ entity: 'Evidence', entityId: evidence.id, action: `AUTO_MODERATE_${status}`, after: { score, engines } });
    return { id: evidence.id, status, score };
  }

  /** Procesa las evidencias PENDIENTE más antiguas (las que quedaron sin moderar). */
  async processPending(limit = 20) {
    const pending = await this.prisma.evidence.findMany({
      where: { status: EvidenceStatus.PENDIENTE },
      orderBy: { createdAt: 'asc' },
      take: limit,
      select: { id: true },
    });
    let processed = 0;
    for (const { id } of pending) if (await this.process(id)) processed += 1;
    return { processed, attempted: pending.length };
  }

  private thresholds(): Thresholds {
    const read = (name: string, fallback: number) => {
      const value = Number(this.config.get<string>(name));
      return Number.isFinite(value) && value > 0 && value <= 1 ? value : fallback;
    };
    return { quarantine: read('MODERATION_QUARANTINE_THRESHOLD', 0.7), ambiguous: read('MODERATION_AMBIGUOUS_THRESHOLD', 0.3) };
  }
}

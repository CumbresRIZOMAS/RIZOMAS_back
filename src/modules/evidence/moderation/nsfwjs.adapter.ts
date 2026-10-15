import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChildProcess, fork } from 'child_process';
import { join } from 'path';
import { ImageModerationAdapter, ModerationResult } from './moderation.port';

type Prediction = { className: string; probability: number };
type Pending = { resolve: (p: Prediction[]) => void; reject: (e: Error) => void; timer: NodeJS.Timeout };

/**
 * Motor principal: NSFWJS (MobileNetV2 incluido en el paquete) corriendo
 * localmente con TensorFlow.js, sin enviar la foto a terceros.
 *
 * El modelo y la decodificación de la foto viven en un proceso hijo que se
 * cierra tras MODERATION_IDLE_MS sin fotos: el sistema recupera toda su memoria,
 * cosa que no pasa con un worker thread. En reposo el backend no carga el modelo
 * (instancia de 512 MB en Render).
 */
@Injectable()
export class NsfwjsAdapter implements ImageModerationAdapter, OnModuleDestroy {
  readonly name = 'NSFWJS';
  private readonly logger = new Logger(NsfwjsAdapter.name);
  private child?: ChildProcess;
  private idleTimer?: NodeJS.Timeout;
  private nextId = 0;
  private readonly pending = new Map<number, Pending>();

  constructor(private readonly config?: ConfigService) {}

  isEnabled() {
    return true;
  }

  async classify(image: Buffer): Promise<ModerationResult> {
    const predictions = await this.send(image);
    const labels = Object.fromEntries(predictions.map((p) => [p.className, p.probability]));
    // Porn y Hentai cuentan completo; Sexy a la mitad (puede ser ropa de trabajo, playa...).
    const score = Math.min(1, (labels.Porn ?? 0) + (labels.Hentai ?? 0) + 0.5 * (labels.Sexy ?? 0));
    return { score, labels };
  }

  /** ¿Está el modelo cargado en memoria? (para pruebas y diagnóstico). */
  get running() {
    return Boolean(this.child && this.child.exitCode === null);
  }

  onModuleDestroy() {
    this.stop();
  }

  stop() {
    clearTimeout(this.idleTimer);
    this.child?.kill();
    this.child = undefined;
  }

  private send(image: Buffer): Promise<Prediction[]> {
    const child = this.ensureChild();
    clearTimeout(this.idleTimer);
    const id = this.nextId++;
    return new Promise<Prediction[]>((resolve, reject) => {
      // La primera foto incluye cargar el modelo (unos segundos).
      const timer = setTimeout(() => this.settle(id, new Error('NSFWJS no respondió a tiempo')), 60_000);
      this.pending.set(id, { resolve, reject, timer });
      // La foto se decodifica en el hijo: así sus búferes también se liberan al cerrarlo.
      child.send({ id, image: new Uint8Array(image) });
    });
  }

  private ensureChild(): ChildProcess {
    if (this.running) return this.child!;
    const child = fork(join(__dirname, 'nsfwjs.child.js'), [], { serialization: 'advanced', stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
    child.on('message', (msg: { id: number; predictions?: Prediction[]; error?: string }) => {
      this.settle(msg.id, msg.error ? new Error(msg.error) : undefined, msg.predictions);
    });
    child.on('exit', (code) => {
      if (this.child === child) this.child = undefined;
      for (const id of [...this.pending.keys()]) this.settle(id, new Error(`NSFWJS terminó (código ${code})`));
    });
    this.child = child;
    return child;
  }

  private settle(id: number, error?: Error, predictions?: Prediction[]) {
    const entry = this.pending.get(id);
    if (!entry) return;
    clearTimeout(entry.timer);
    this.pending.delete(id);
    if (error) entry.reject(error);
    else entry.resolve(predictions ?? []);
    if (this.pending.size === 0) this.scheduleIdleStop();
  }

  private scheduleIdleStop() {
    clearTimeout(this.idleTimer);
    const idle = Number(this.config?.get<string>('MODERATION_IDLE_MS'));
    this.idleTimer = setTimeout(
      () => {
        this.logger.log('NSFWJS inactivo: se libera la memoria del modelo');
        this.stop();
      },
      Number.isFinite(idle) && idle > 0 ? idle : 60_000,
    );
    this.idleTimer.unref();
  }
}

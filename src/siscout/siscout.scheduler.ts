import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { SiscoutConfigService } from './config/siscout-config.service';
import { SiscoutSyncService } from './siscout-sync.service';

const JOB_NAME = 'siscout-sync';

/**
 * Programa la sincronización periódica según la configuración vigente.
 *
 * La expresión cron y el interruptor viven en la configuración editable, no en
 * el entorno, así que el trabajo se (re)programa en tiempo de ejecución: cuando
 * la configuración cambia, se descarta el cron anterior y se crea el nuevo, o se
 * detiene si quedó deshabilitado. No hace falta reiniciar la aplicación.
 */
@Injectable()
export class SiscoutScheduler implements OnModuleInit {
  private readonly logger = new Logger(SiscoutScheduler.name);

  constructor(
    private readonly syncService: SiscoutSyncService,
    private readonly registry: SchedulerRegistry,
    private readonly config: SiscoutConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.config.ensureLoaded();
    await this.applySchedule();
    this.config.onChange(() => {
      void this.applySchedule();
    });
  }

  /** Aplica la configuración vigente al cron: lo crea, lo reemplaza o lo detiene. */
  private async applySchedule(): Promise<void> {
    if (this.registry.doesExist('cron', JOB_NAME)) {
      await this.registry.getCronJob(JOB_NAME).stop();
      this.registry.deleteCronJob(JOB_NAME);
    }

    const { syncEnabled, syncCron } = this.config.get();

    if (!syncEnabled) {
      this.logger.log('Sincronización programada deshabilitada');
      return;
    }

    const job = new CronJob(syncCron, () => {
      void this.run();
    });

    this.registry.addCronJob(JOB_NAME, job);
    job.start();

    this.logger.log(`Sincronización programada con la expresión "${syncCron}"`);
  }

  private async run(): Promise<void> {
    try {
      await this.syncService.synchronize();
    } catch (error) {
      // Una corrida fallida no debe tumbar el proceso ni cancelar las siguientes.
      this.logger.error(
        `La sincronización programada falló: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}

import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import type { AppConfigService } from '../config';
import { SiscoutSyncService } from './siscout-sync.service';

/**
 * Programa la sincronización periódica.
 *
 * El cron se registra en tiempo de ejecución (y no con el decorador `@Cron`)
 * porque tanto la expresión como el interruptor vienen de la configuración: así
 * en local se puede dejar apagado sin tocar código.
 */
@Injectable()
export class SiscoutScheduler implements OnModuleInit {
  private readonly logger = new Logger(SiscoutScheduler.name);

  constructor(
    private readonly syncService: SiscoutSyncService,
    private readonly registry: SchedulerRegistry,
    @Inject(ConfigService)
    private readonly config: AppConfigService,
  ) {}

  onModuleInit(): void {
    const enabled = this.config.get('SISCOUT_SYNC_ENABLED', { infer: true });

    if (!enabled) {
      this.logger.log(
        'Sincronización programada deshabilitada (SISCOUT_SYNC_ENABLED=false)',
      );
      return;
    }

    const expression = this.config.get('SISCOUT_SYNC_CRON', { infer: true });

    const job = new CronJob(expression, () => {
      void this.run();
    });

    this.registry.addCronJob('siscout-sync', job);
    job.start();

    this.logger.log(`Sincronización programada con la expresión ""`);
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

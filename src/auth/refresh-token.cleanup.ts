import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { RefreshToken } from './refresh-token.entity';

/**
 * Limpieza de refresh tokens vencidos. Sustituye al índice TTL de Mongo del
 * sistema anterior, que Postgres no tiene: una vez al día se eliminan los que
 * ya expiraron. Los revocados vigentes se conservan hasta vencer — son la
 * evidencia que impide reusar un token rotado.
 */
@Injectable()
export class RefreshTokenCleanup {
  private readonly logger = new Logger(RefreshTokenCleanup.name);

  constructor(
    @InjectRepository(RefreshToken)
    private readonly refreshTokens: Repository<RefreshToken>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async sweep(): Promise<void> {
    const { affected } = await this.refreshTokens.delete({
      expiresAt: LessThan(new Date()),
    });
    if (affected) {
      this.logger.log(`Refresh tokens vencidos eliminados: ${affected}`);
    }
  }
}

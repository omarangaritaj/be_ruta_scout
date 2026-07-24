import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { SiscoutSyncService, type SyncResult } from './siscout-sync.service';

/**
 * ⚠️ Este controlador NO expone datos de SiScout: solo dispara la
 * sincronización y devuelve el recuento de la corrida. El payload externo no
 * sale de `siscout_snapshots` por ninguna vía.
 *
 * PENDIENTE: proteger con guard de autenticación/rol cuando exista auth.
 */
@Controller('siscout')
export class SiscoutController {
  constructor(private readonly syncService: SiscoutSyncService) {}

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  async sync(): Promise<SyncResult> {
    return this.syncService.synchronize();
  }
}

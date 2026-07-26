import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../authz/permissions.guard';
import { RequirePermissions } from '../authz/require-permissions.decorator';
import { SiscoutSyncService, type SyncResult } from './siscout-sync.service';

/**
 * ⚠️ Este controlador NO expone datos de SiScout: solo dispara la
 * sincronización y devuelve el recuento de la corrida. El payload externo no
 * sale de `siscout_snapshots` por ninguna vía.
 */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('siscout')
export class SiscoutController {
  constructor(private readonly syncService: SiscoutSyncService) {}

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('siscout:sync')
  async sync(): Promise<SyncResult> {
    return this.syncService.synchronize();
  }
}

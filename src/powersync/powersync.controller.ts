import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { ZodValidationPipe } from '../common';
import { writeBatchSchema, type WriteBatchDto } from './dto/write-batch.dto';
import { PowersyncService } from './powersync.service';

/**
 * Backend connector de PowerSync: recibe el lote de escrituras que el cliente
 * capturó sin conexión y las aplica a Mongo. Va tras JwtAuthGuard (el token
 * normal de be_ruta); el token de PowerSync es solo para el servicio de sync.
 */
@UseGuards(JwtAuthGuard)
@Controller('powersync')
export class PowersyncController {
  constructor(private readonly powersyncService: PowersyncService) {}

  @Post('write')
  @HttpCode(HttpStatus.NO_CONTENT)
  async write(
    @Req() req: { user: AuthUser },
    @Body(new ZodValidationPipe(writeBatchSchema)) dto: WriteBatchDto,
  ): Promise<void> {
    await this.powersyncService.applyWrites(req.user.userId, dto.ops);
  }
}

import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /** Healthcheck para Traefik/compose y monitoreo. */
  @Get('health')
  health(): { status: string } {
    return this.appService.health();
  }
}

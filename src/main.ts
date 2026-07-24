import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import type { AppConfigService } from './config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // El puerto ya viene validado y convertido a número por el esquema de entorno.
  const config: AppConfigService = app.get(ConfigService);
  await app.listen(config.get('PORT', { infer: true }));
}
void bootstrap();

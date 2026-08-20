import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import type { AppConfigService } from './config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config: AppConfigService = app.get(ConfigService);

  // En v2 el FE es una PWA client-only: el navegador llama directo a esta API
  // (en el sistema anterior mediaba el BFF de Next y CORS no era necesario).
  app.enableCors({
    origin: config.get('CORS_ORIGINS', { infer: true }),
    credentials: true,
  });

  // El puerto ya viene validado y convertido a número por el esquema de entorno.
  await app.listen(config.get('PORT', { infer: true }));
}
void bootstrap();

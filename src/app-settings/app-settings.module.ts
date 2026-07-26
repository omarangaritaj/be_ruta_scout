import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppSettingsService } from './app-settings.service';
import { AppSettings, AppSettingsSchema } from './schemas/app-settings.schema';

/**
 * Módulo GLOBAL: la configuración general de la aplicación debe poder inyectarse
 * en cualquier parte sin importar el módulo una y otra vez. Con importarlo una
 * vez en `AppModule`, `AppSettingsService` queda disponible en todo el contenedor.
 */
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AppSettings.name, schema: AppSettingsSchema },
    ]),
  ],
  providers: [AppSettingsService],
  exports: [AppSettingsService],
})
export class AppSettingsModule {}

import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppConfigModule } from './config';
import { DatabaseModule } from './database/database.module';
import { UnidadesModule } from './unidades/unidades.module';

@Module({
  imports: [AppConfigModule, DatabaseModule, UnidadesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppConfigModule } from './config';
import { DatabaseModule } from './database/database.module';
import { GruposModule } from './grupos/grupos.module';
import { UnidadesModule } from './unidades/unidades.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    UsersModule,
    GruposModule,
    UnidadesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppConfigModule } from './config';
import { DatabaseModule } from './database/database.module';
import { GruposModule } from './grupos/grupos.module';
import { RolesModule } from './roles/roles.module';
import { SiscoutConfigModule } from './siscout/config/siscout-config.module';
import { SiscoutModule } from './siscout/siscout.module';
import { UnidadesModule } from './unidades/unidades.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    SiscoutConfigModule,
    RolesModule,
    UsersModule,
    GruposModule,
    UnidadesModule,
    SiscoutModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

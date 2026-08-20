import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { AppConfigService } from '../config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: AppConfigService) => ({
        type: 'postgres' as const,
        url: config.get('DATABASE_URL', { infer: true }),
        // Todo el esquema vive en `ruta`, NUNCA en `public`. En Supabase el
        // schema `public` lo publica PostgREST con la anon key (clave pública
        // por diseño) y arrastra `ALTER DEFAULT PRIVILEGES ... IN SCHEMA public
        // GRANT ALL ON TABLES TO anon`, así que una tabla creada ahí nace
        // legible desde internet. Un schema propio no hereda esos privilegios.
        // TypeORM no usa `SET search_path`: califica cada nombre como
        // "ruta"."tabla", así que esto es seguro con el pooler de Supabase en
        // modo transaction (sin estado de sesión que se recicle entre queries).
        schema: 'ruta',
        // Las entidades se registran por módulo con `TypeOrmModule.forFeature`;
        // autoLoadEntities evita mantener una lista central duplicada.
        autoLoadEntities: true,
        // El esquema evoluciona SOLO por migraciones (pnpm migration:run).
        // synchronize en true destruiría datos ante cualquier cambio de entidad.
        synchronize: false,
      }),
    }),
  ],
})
export class DatabaseModule {}

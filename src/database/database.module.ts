import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { Connection, ConnectionStates } from 'mongoose';
import type { AppConfigService } from '../config';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: AppConfigService) => ({
        uri: config.get('MONGODB_URI', { infer: true }),
        connectionFactory: (connection: Connection) => {
          const logger = new Logger('MongooseConnection');
          const conectado = () =>
            logger.log(`Conectado a la base de datos "${connection.name}"`);

          // Nest invoca esta factory con la conexión ya establecida, por lo que
          // el evento 'connected' ya se emitió: hay que consultar el estado.
          if (connection.readyState === ConnectionStates.connected) {
            conectado();
          }

          connection.on('connected', conectado);
          connection.on('reconnected', () =>
            logger.log('Reconectado a MongoDB'),
          );
          connection.on('disconnected', () =>
            logger.warn('Desconectado de MongoDB'),
          );
          connection.on('error', (error: Error) =>
            logger.error(`Error de conexión: ${error.message}`),
          );

          return connection;
        },
      }),
    }),
  ],
})
export class DatabaseModule {}

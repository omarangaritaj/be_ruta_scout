import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailModule } from '../email/email.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { SiscoutModule } from '../siscout/siscout.module';
import { User } from './user.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    // Suspender o restablecer el acceso avisa a la persona: sin estos dos
    // módulos, cambiar `estadoAcceso` era estructuralmente incapaz de
    // notificar, y quien quedaba suspendido se enteraba al chocar con el muro.
    EmailModule,
    NotificacionesModule,
    SiscoutModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService, TypeOrmModule],
})
export class UsersModule {}

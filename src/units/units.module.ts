import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { UnitMembership } from './unit-membership.entity';
import { Unit } from './unit.entity';
import { UnitsController } from './units.controller';
import { UnitsService } from './units.service';

@Module({
  imports: [TypeOrmModule.forFeature([Unit, UnitMembership, User])],
  controllers: [UnitsController],
  providers: [UnitsService],
  exports: [UnitsService, TypeOrmModule],
})
export class UnitsModule {}

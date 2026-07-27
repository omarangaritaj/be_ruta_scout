import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../users/schemas/user.schema';
import {
  UnitMembership,
  UnitMembershipSchema,
} from './schemas/unit-membership.schema';
import { Unit, UnitSchema } from './schemas/unit.schema';
import { UnitsController } from './units.controller';
import { UnitsService } from './units.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Unit.name, schema: UnitSchema },
      { name: UnitMembership.name, schema: UnitMembershipSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [UnitsController],
  providers: [UnitsService],
  exports: [UnitsService, MongooseModule],
})
export class UnitsModule {}

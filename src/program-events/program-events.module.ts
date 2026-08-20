import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cycle } from '../cycles/cycle.entity';
import { LearningOpportunity } from '../opportunities/learning-opportunity.entity';
import { UnitsModule } from '../units/units.module';
import { ProgramEventOpportunity } from './program-event-opportunity.entity';
import { ProgramEvent } from './program-event.entity';
import { ProgramEventsController } from './program-events.controller';
import { ProgramEventsService } from './program-events.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProgramEvent,
      ProgramEventOpportunity,
      Cycle,
      LearningOpportunity,
    ]),
    UnitsModule,
  ],
  controllers: [ProgramEventsController],
  providers: [ProgramEventsService],
  exports: [ProgramEventsService],
})
export class ProgramEventsModule {}

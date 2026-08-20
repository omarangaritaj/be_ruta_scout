import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GrowthItemsModule } from '../growth-items/growth-items.module';
import { QuestionsModule } from '../questions/questions.module';
import { UnitsModule } from '../units/units.module';
import { LearningOpportunity } from '../opportunities/learning-opportunity.entity';
import { Cycle } from './cycle.entity';
import { CyclesController } from './cycles.controller';
import { CyclesService } from './cycles.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Cycle, LearningOpportunity]),
    UnitsModule,
    QuestionsModule,
    GrowthItemsModule,
  ],
  controllers: [CyclesController],
  providers: [CyclesService],
  exports: [CyclesService, TypeOrmModule],
})
export class CyclesModule {}

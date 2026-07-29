import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GrowthItemsModule } from '../growth-items/growth-items.module';
import { QuestionsModule } from '../questions/questions.module';
import { UnitsModule } from '../units/units.module';
import { Cycle, CycleSchema } from './schemas/cycle.schema';
import { CyclesController } from './cycles.controller';
import { CyclesService } from './cycles.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Cycle.name, schema: CycleSchema }]),
    UnitsModule,
    QuestionsModule,
    GrowthItemsModule,
  ],
  controllers: [CyclesController],
  providers: [CyclesService],
  exports: [CyclesService],
})
export class CyclesModule {}

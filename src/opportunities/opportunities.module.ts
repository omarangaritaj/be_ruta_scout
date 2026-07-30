import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CyclesModule } from '../cycles/cycles.module';
import {
  LearningOpportunity,
  LearningOpportunitySchema,
} from './schemas/learning-opportunity.schema';
import { OpportunitiesController } from './opportunities.controller';
import { OpportunitiesService } from './opportunities.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LearningOpportunity.name, schema: LearningOpportunitySchema },
    ]),
    CyclesModule,
  ],
  controllers: [OpportunitiesController],
  providers: [OpportunitiesService],
})
export class OpportunitiesModule {}

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GrowthItem, GrowthItemSchema } from './schemas/growth-item.schema';
import { GrowthItemsController } from './growth-items.controller';
import { GrowthItemsService } from './growth-items.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: GrowthItem.name, schema: GrowthItemSchema },
    ]),
  ],
  controllers: [GrowthItemsController],
  providers: [GrowthItemsService],
  exports: [GrowthItemsService, MongooseModule],
})
export class GrowthItemsModule {}

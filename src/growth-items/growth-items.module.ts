import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GrowthItem } from './growth-item.entity';
import { GrowthItemsController } from './growth-items.controller';
import { GrowthItemsService } from './growth-items.service';

@Module({
  imports: [TypeOrmModule.forFeature([GrowthItem])],
  controllers: [GrowthItemsController],
  providers: [GrowthItemsService],
  exports: [GrowthItemsService, TypeOrmModule],
})
export class GrowthItemsModule {}

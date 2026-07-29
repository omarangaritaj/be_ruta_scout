import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../authz/permissions.guard';
import { RequirePermissions } from '../authz/require-permissions.decorator';
import { ParseObjectIdPipe, ZodValidationPipe } from '../common';
import {
  createGrowthItemSchema,
  type CreateGrowthItemDto,
} from './dto/create-growth-item.dto';
import {
  listGrowthItemsSchema,
  type ListGrowthItemsDto,
} from './dto/list-growth-items.dto';
import {
  updateGrowthItemSchema,
  type UpdateGrowthItemDto,
} from './dto/update-growth-item.dto';
import { GrowthItemDocument } from './schemas/growth-item.schema';
import { GrowthItemsService } from './growth-items.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('growth-items')
export class GrowthItemsController {
  constructor(private readonly growthItemsService: GrowthItemsService) {}

  @Get()
  @RequirePermissions('growth-item:read')
  async findAll(
    @Query(new ZodValidationPipe(listGrowthItemsSchema))
    query: ListGrowthItemsDto,
  ): Promise<GrowthItemDocument[]> {
    return this.growthItemsService.findAll(
      query.branch,
      query.growthArea,
      query.includeInactive,
    );
  }

  @Post()
  @RequirePermissions('growth-item:create')
  async create(
    @Body(new ZodValidationPipe(createGrowthItemSchema))
    dto: CreateGrowthItemDto,
  ): Promise<GrowthItemDocument> {
    return this.growthItemsService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('growth-item:update')
  async update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body(new ZodValidationPipe(updateGrowthItemSchema))
    dto: UpdateGrowthItemDto,
  ): Promise<GrowthItemDocument> {
    return this.growthItemsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('growth-item:delete')
  async remove(@Param('id', ParseObjectIdPipe) id: string): Promise<void> {
    return this.growthItemsService.remove(id);
  }
}

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppConflictException, AppNotFoundException } from '../common';
import { type Branch, type GrowthArea } from '../domain';
import { K } from '../i18n';
import { CreateGrowthItemDto } from './dto/create-growth-item.dto';
import { UpdateGrowthItemDto } from './dto/update-growth-item.dto';
import { assertAreaBelongsToBranch } from './growth-item-rules';
import { GrowthItem, GrowthItemDocument } from './schemas/growth-item.schema';

const DUPLICATE_KEY = 11000;

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: number }).code === DUPLICATE_KEY
  );
}

@Injectable()
export class GrowthItemsService {
  constructor(
    @InjectModel(GrowthItem.name)
    private readonly growthItemModel: Model<GrowthItemDocument>,
  ) {}

  async findAll(
    branch?: Branch,
    growthArea?: GrowthArea,
    includeInactive = false,
  ): Promise<GrowthItemDocument[]> {
    const filter: Record<string, unknown> = includeInactive
      ? {}
      : { isActive: true };
    if (branch) filter.branch = branch;
    if (growthArea) filter.growthArea = growthArea;
    return this.growthItemModel
      .find(filter)
      .sort({ branch: 1, growthArea: 1, order: 1 })
      .exec();
  }

  async create(dto: CreateGrowthItemDto): Promise<GrowthItemDocument> {
    assertAreaBelongsToBranch(dto.branch, dto.growthArea);
    try {
      return await this.growthItemModel.create(dto);
    } catch (error) {
      if (isDuplicateKey(error)) {
        throw new AppConflictException(K.GROWTH_ITEMS.ORDER_TAKEN, {
          order: dto.order,
        });
      }
      throw error;
    }
  }

  async update(
    id: string,
    dto: UpdateGrowthItemDto,
  ): Promise<GrowthItemDocument> {
    if (dto.branch || dto.growthArea) {
      const current = await this.growthItemModel.findById(id).exec();
      if (!current) {
        throw new AppNotFoundException(K.GROWTH_ITEMS.NOT_FOUND, { id });
      }
      assertAreaBelongsToBranch(
        dto.branch ?? current.branch,
        dto.growthArea ?? current.growthArea,
      );
    }

    try {
      const updated = await this.growthItemModel
        .findByIdAndUpdate(id, dto, { new: true })
        .exec();
      if (!updated) {
        throw new AppNotFoundException(K.GROWTH_ITEMS.NOT_FOUND, { id });
      }
      return updated;
    } catch (error) {
      if (isDuplicateKey(error)) {
        let order = dto.order;
        if (order === undefined) {
          const persisted = await this.growthItemModel.findById(id).exec();
          order = persisted?.order;
        }
        if (order === undefined) throw error;
        throw new AppConflictException(K.GROWTH_ITEMS.ORDER_TAKEN, { order });
      }
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    const updated = await this.growthItemModel
      .findByIdAndUpdate(id, { isActive: false })
      .exec();
    if (!updated) {
      throw new AppNotFoundException(K.GROWTH_ITEMS.NOT_FOUND, { id });
    }
  }
}

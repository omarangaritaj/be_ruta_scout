import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, type FindOptionsWhere } from 'typeorm';
import { AppConflictException, AppNotFoundException } from '../common';
import { type Branch, type GrowthArea } from '../domain';
import { K } from '../i18n';
import { CreateGrowthItemDto } from './dto/create-growth-item.dto';
import { UpdateGrowthItemDto } from './dto/update-growth-item.dto';
import { assertAreaBelongsToBranch } from './growth-item-rules';
import { GrowthItem } from './growth-item.entity';

/** Código que devuelve Postgres al violar un índice único. */
const UNIQUE_VIOLATION = '23505';

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'driverError' in error &&
    (error as { driverError?: { code?: string } }).driverError?.code ===
      UNIQUE_VIOLATION
  );
}

@Injectable()
export class GrowthItemsService {
  constructor(
    @InjectRepository(GrowthItem)
    private readonly growthItems: Repository<GrowthItem>,
  ) {}

  async findAll(
    branch?: Branch,
    growthArea?: GrowthArea,
    includeInactive = false,
  ): Promise<GrowthItem[]> {
    const where: FindOptionsWhere<GrowthItem> = includeInactive
      ? {}
      : { isActive: true };
    if (branch) where.branch = branch;
    if (growthArea) where.growthArea = growthArea;
    return this.growthItems.find({
      where,
      order: { branch: 'ASC', growthArea: 'ASC', order: 'ASC' },
    });
  }

  async create(dto: CreateGrowthItemDto): Promise<GrowthItem> {
    assertAreaBelongsToBranch(dto.branch, dto.growthArea);
    try {
      return await this.growthItems.save(this.growthItems.create(dto));
    } catch (error) {
      if (isDuplicateKey(error)) {
        throw new AppConflictException(K.GROWTH_ITEMS.ORDER_TAKEN, {
          order: dto.order,
        });
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateGrowthItemDto): Promise<GrowthItem> {
    const current = await this.growthItems.findOne({ where: { id } });
    if (!current) {
      throw new AppNotFoundException(K.GROWTH_ITEMS.NOT_FOUND, { id });
    }
    if (dto.branch || dto.growthArea) {
      assertAreaBelongsToBranch(
        dto.branch ?? current.branch,
        dto.growthArea ?? current.growthArea,
      );
    }

    try {
      Object.assign(current, dto);
      return await this.growthItems.save(current);
    } catch (error) {
      if (isDuplicateKey(error)) {
        throw new AppConflictException(K.GROWTH_ITEMS.ORDER_TAKEN, {
          order: dto.order ?? current.order,
        });
      }
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    const { affected } = await this.growthItems.update(
      { id },
      { isActive: false },
    );
    if (!affected) {
      throw new AppNotFoundException(K.GROWTH_ITEMS.NOT_FOUND, { id });
    }
  }
}

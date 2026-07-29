import { z } from 'zod';
import { growthItemBaseSchema } from './growth-item-base.schema';

export const createGrowthItemSchema = growthItemBaseSchema.omit({
  isActive: true,
});

export type CreateGrowthItemDto = z.infer<typeof createGrowthItemSchema>;

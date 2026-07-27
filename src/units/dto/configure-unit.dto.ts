import { z } from 'zod';
import { unitBaseSchema } from './unit-base.schema';

export const configureUnitSchema = unitBaseSchema.pick({
  name: true,
  unitLeaderId: true,
  leaders: true,
  city: true,
});

export type ConfigureUnitDto = z.infer<typeof configureUnitSchema>;

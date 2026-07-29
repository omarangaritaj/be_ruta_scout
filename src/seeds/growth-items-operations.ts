import { type Branch, type GrowthArea } from '../domain';

export interface GrowthItemSeed {
  branch: string;
  growthArea: string;
  order: number;
  text: string;
}

export interface SeedOperation {
  updateOne: {
    filter: { branch: Branch; growthArea: GrowthArea; order: number };
    update: { $setOnInsert: { text: string; isActive: boolean } };
    upsert: true;
  };
}

/**
 * `$setOnInsert` y nunca `$set`: la semilla puebla, no reconcilia. Un item ya
 * existente conserva el texto y el estado que le haya dado un administrador.
 */
export function buildSeedOperations(
  catalog: GrowthItemSeed[],
): SeedOperation[] {
  return catalog.map((item) => ({
    updateOne: {
      filter: {
        branch: item.branch as Branch,
        growthArea: item.growthArea as GrowthArea,
        order: item.order,
      },
      update: { $setOnInsert: { text: item.text, isActive: true } },
      upsert: true,
    },
  }));
}

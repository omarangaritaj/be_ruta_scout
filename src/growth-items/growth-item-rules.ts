import { AppBadRequestException } from '../common';
import { growthAreasOf, type Branch, type GrowthArea } from '../domain';
import { K } from '../i18n';

export function assertAreaBelongsToBranch(
  branch: Branch,
  growthArea: GrowthArea,
): void {
  if (growthAreasOf(branch).includes(growthArea)) return;
  throw new AppBadRequestException(K.GROWTH_ITEMS.AREA_NOT_IN_BRANCH, {
    area: growthArea,
    rama: branch,
  });
}

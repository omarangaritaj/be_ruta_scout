import { AppBadRequestException } from '../common';
import { assertAreaBelongsToBranch } from './growth-item-rules';

describe('assertAreaBelongsToBranch', () => {
  it('acepta un área que la rama sí usa', () => {
    expect(() =>
      assertAreaBelongsToBranch('tropa', 'afectividad'),
    ).not.toThrow();
  });

  it('acepta socioafectividad en familia', () => {
    expect(() =>
      assertAreaBelongsToBranch('familia', 'socioafectividad'),
    ).not.toThrow();
  });

  it('rechaza afectividad en familia', () => {
    expect(() => assertAreaBelongsToBranch('familia', 'afectividad')).toThrow(
      AppBadRequestException,
    );
  });

  it('rechaza socioafectividad fuera de familia', () => {
    expect(() =>
      assertAreaBelongsToBranch('tropa', 'socioafectividad'),
    ).toThrow(AppBadRequestException);
  });
});

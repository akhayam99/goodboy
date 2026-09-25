import type { ProviderLimitWindow } from '@goodboy/types';
import { LIMITS_WARNING_FRACTION } from '@goodboy/core';

type Params = {
  readonly window: ProviderLimitWindow;
};

export const windowTone = ({ window }: Params): string => {
  if (window.status === 'reached' || (window.usedFraction !== null && window.usedFraction >= 1)) {
    return 'text-danger';
  }
  if (
    window.status === 'warning' ||
    (window.usedFraction !== null && window.usedFraction >= LIMITS_WARNING_FRACTION)
  ) {
    return 'text-warning';
  }
  return 'text-foreground';
};

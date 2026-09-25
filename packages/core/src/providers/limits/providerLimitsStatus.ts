import type { ProviderLimitStatus, ProviderLimitWindow } from '@goodboy/types';
import { LIMITS_WARNING_FRACTION } from './constants';

type WindowParams = {
  readonly window: ProviderLimitWindow;
};

export const windowStatus = ({ window }: WindowParams): ProviderLimitStatus => {
  if (window.status === 'reached' || (window.usedFraction !== null && window.usedFraction >= 1)) {
    return 'reached';
  }
  if (
    window.status === 'warning' ||
    (window.usedFraction !== null && window.usedFraction >= LIMITS_WARNING_FRACTION)
  ) {
    return 'warning';
  }
  return 'ok';
};

type Params = {
  readonly windows: ReadonlyArray<ProviderLimitWindow>;
};

export const providerLimitsStatus = ({ windows }: Params): ProviderLimitStatus => {
  const statuses = windows.map((window) => windowStatus({ window }));
  if (statuses.includes('reached')) {
    return 'reached';
  }
  if (statuses.includes('warning')) {
    return 'warning';
  }
  return 'ok';
};

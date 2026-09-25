import { LIMITS_WARNING_FRACTION } from '@goodboy/core';
import type { ProviderLimitWindow } from '@goodboy/types';

export type WindowTone = 'danger' | 'warning' | 'neutral';

type Params = {
  readonly window: ProviderLimitWindow;
};

export const windowTone = ({ window }: Params): WindowTone => {
  if (window.status === 'reached' || (window.usedFraction !== null && window.usedFraction >= 1)) {
    return 'danger';
  }
  if (
    window.status === 'warning' ||
    (window.usedFraction !== null && window.usedFraction >= LIMITS_WARNING_FRACTION)
  ) {
    return 'warning';
  }
  return 'neutral';
};

export const WINDOW_TONE_TEXT: Readonly<Record<WindowTone, string>> = {
  danger: 'text-danger',
  warning: 'text-warning',
  neutral: 'text-foreground',
};

export const WINDOW_TONE_FILL: Readonly<Record<WindowTone, string>> = {
  danger: 'bg-danger',
  warning: 'bg-warning',
  neutral: 'bg-muted-foreground',
};

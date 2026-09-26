import type { ProviderLimitWindow } from '@goodboy/types';

type Params = {
  readonly window: ProviderLimitWindow;
};

export const limitWindowShortLabel = ({ window }: Params): string => {
  switch (window.kind) {
    case 'fiveHour':
      return '5h';
    case 'weekly':
      return 'wk';
    case 'weeklyModel':
      return window.model ?? 'wk';
    default: {
      const exhaustive: never = window.kind;
      return exhaustive;
    }
  }
};

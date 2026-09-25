import type { ProviderLimitWindow } from '@goodboy/types';

type Params = {
  readonly window: ProviderLimitWindow;
  readonly siblings: ReadonlyArray<ProviderLimitWindow>;
};

export const limitWindowLabel = ({ window, siblings }: Params): string => {
  switch (window.kind) {
    case 'fiveHour':
      return '5-hour window';
    case 'weekly':
      return siblings.some((sibling) => sibling.kind === 'weeklyModel')
        ? 'Weekly, all models'
        : 'Weekly';
    case 'weeklyModel':
      return `Weekly, ${window.model ?? 'one model'}`;
    default: {
      const exhaustive: never = window.kind;
      return exhaustive;
    }
  }
};

const KIND_ORDER: Readonly<Record<ProviderLimitWindow['kind'], number>> = {
  fiveHour: 0,
  weekly: 1,
  weeklyModel: 2,
};

type SortParams = {
  readonly windows: ReadonlyArray<ProviderLimitWindow>;
};

export const sortLimitWindows = ({ windows }: SortParams): ReadonlyArray<ProviderLimitWindow> =>
  [...windows].sort((left, right) => KIND_ORDER[left.kind] - KIND_ORDER[right.kind]);

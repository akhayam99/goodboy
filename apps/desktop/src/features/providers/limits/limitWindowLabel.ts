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

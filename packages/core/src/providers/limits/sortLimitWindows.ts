import type { ProviderLimitWindow, ProviderLimitWindowKind } from '@goodboy/types';

const WINDOW_ORDER: Readonly<Record<ProviderLimitWindowKind, number>> = {
  fiveHour: 0,
  weekly: 1,
  weeklyModel: 2,
};

type Params = {
  readonly windows: ReadonlyArray<ProviderLimitWindow>;
};

export const sortLimitWindows = ({ windows }: Params): ReadonlyArray<ProviderLimitWindow> =>
  [...windows].sort((left, right) => WINDOW_ORDER[left.kind] - WINDOW_ORDER[right.kind]);

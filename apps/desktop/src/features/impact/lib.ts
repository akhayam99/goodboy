import type { SegmentedTabOption } from '@goodboy/ui';

export type ImpactWindowId = 'last30' | 'all';

export const IMPACT_WINDOW_DAYS = 30;

export const IMPACT_WINDOW_OPTIONS: ReadonlyArray<SegmentedTabOption<ImpactWindowId>> = [
  { value: 'last30', label: 'Last 30 days' },
  { value: 'all', label: 'All time' },
];

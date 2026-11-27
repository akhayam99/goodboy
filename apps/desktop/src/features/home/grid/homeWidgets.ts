import { NAMES } from '../../../shared/utils/names';

export type HomeWidgetId = 'sessionsToFinish' | 'needsYou' | 'runningNow' | 'providerLimits';

export type WidgetSize = 'S' | 'M' | 'L';

export type WidgetSpan = {
  readonly cols: number;
  readonly rows: number;
};

export type HomeWidgetSpec = {
  readonly id: HomeWidgetId;
  readonly title: string;
  readonly spans: Readonly<Partial<Record<WidgetSize, WidgetSpan>>>;
  readonly defaultSize: WidgetSize;
};

export const HOME_WIDGETS: Readonly<Record<HomeWidgetId, HomeWidgetSpec>> = {
  sessionsToFinish: {
    id: 'sessionsToFinish',
    title: 'Sessions to finish',
    spans: {
      S: { cols: 1, rows: 2 },
      M: { cols: 2, rows: 2 },
      L: { cols: 4, rows: 2 },
    },
    defaultSize: 'L',
  },
  needsYou: {
    id: 'needsYou',
    title: 'Needs you',
    spans: {
      S: { cols: 1, rows: 2 },
      M: { cols: 2, rows: 3 },
      L: { cols: 4, rows: 3 },
    },
    defaultSize: 'M',
  },
  runningNow: {
    id: 'runningNow',
    title: 'Running now',
    spans: {
      S: { cols: 1, rows: 2 },
      M: { cols: 2, rows: 3 },
      L: { cols: 4, rows: 3 },
    },
    defaultSize: 'M',
  },
  providerLimits: {
    id: 'providerLimits',
    title: NAMES.usage,
    spans: {
      S: { cols: 1, rows: 2 },
      M: { cols: 2, rows: 4 },
      L: { cols: 4, rows: 3 },
    },
    defaultSize: 'M',
  },
};

export const DEFAULT_HOME_LAYOUT: ReadonlyArray<HomeWidgetId> = [
  'sessionsToFinish',
  'needsYou',
  'runningNow',
  'providerLimits',
];

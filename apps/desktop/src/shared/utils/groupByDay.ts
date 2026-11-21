import { dayLabelOf } from './time/dayLabelOf';

type DayBucket = 'today' | 'yesterday' | 'this-week' | 'older';

type BucketLabelParams = {
  readonly now: Date;
};

const bucketLabelsOf = ({ now }: BucketLabelParams): Record<DayBucket, string> => {
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  return {
    today: dayLabelOf({ at: now.getTime(), now: now.getTime() }),
    yesterday: dayLabelOf({ at: yesterday.getTime(), now: now.getTime() }),
    'this-week': 'This week',
    older: 'Older',
  };
};

const DAY_BUCKETS = ['today', 'yesterday', 'this-week', 'older'] as const;

export type DayGroup<T> = {
  readonly day: DayBucket;
  readonly label: string;
  readonly items: ReadonlyArray<T>;
};

type Boundaries = {
  readonly today: number;
  readonly yesterday: number;
  readonly week: number;
};

type BoundariesParams = {
  readonly now: Date;
};

const dayBoundaries = ({ now }: BoundariesParams): Boundaries => {
  const year = now.getFullYear();
  const month = now.getMonth();
  const date = now.getDate();
  const daysSinceMonday = (now.getDay() + 6) % 7;
  return {
    today: new Date(year, month, date).getTime(),
    yesterday: new Date(year, month, date - 1).getTime(),
    week: new Date(year, month, date - daysSinceMonday).getTime(),
  };
};

type BucketParams = {
  readonly timestamp: number;
  readonly boundaries: Boundaries;
};

const bucketFor = ({ timestamp, boundaries }: BucketParams): DayBucket => {
  if (Number.isNaN(timestamp)) {
    return 'older';
  }
  if (timestamp >= boundaries.today) {
    return 'today';
  }
  if (timestamp >= boundaries.yesterday) {
    return 'yesterday';
  }
  if (timestamp >= boundaries.week) {
    return 'this-week';
  }
  return 'older';
};

type GroupByDayParams<T> = {
  readonly items: ReadonlyArray<T>;
  readonly timestampOf: (item: T) => string;
  readonly now: Date;
};

export const groupByDay = <T>({
  items,
  timestampOf,
  now,
}: GroupByDayParams<T>): ReadonlyArray<DayGroup<T>> => {
  const boundaries = dayBoundaries({ now });
  const labels = bucketLabelsOf({ now });
  const buckets: Record<DayBucket, Array<T>> = {
    today: [],
    yesterday: [],
    'this-week': [],
    older: [],
  };
  for (const item of items) {
    buckets[bucketFor({ timestamp: Date.parse(timestampOf(item)), boundaries })].push(item);
  }
  return DAY_BUCKETS.map((day) => ({
    day,
    label: labels[day],
    items: buckets[day],
  })).filter((group) => group.items.length > 0);
};

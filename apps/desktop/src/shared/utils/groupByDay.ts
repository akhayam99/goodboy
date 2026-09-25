export type DayBucket = 'today' | 'yesterday' | 'this-week' | 'older';

export const DAY_BUCKET_LABEL = {
  today: 'Today',
  yesterday: 'Yesterday',
  'this-week': 'This week',
  older: 'Older',
} satisfies Record<DayBucket, string>;

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
    label: DAY_BUCKET_LABEL[day],
    items: buckets[day],
  })).filter((group) => group.items.length > 0);
};

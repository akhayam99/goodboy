import { isBotLogin } from '@goodboy/core/review-source';
import type { PullRequestActivityFilter } from '../../../../store/slices/pull-request-view/state';
import type { ActivityItem } from './activityOf';

export type ActivityFilter = PullRequestActivityFilter;

type ActivityLane = Exclude<ActivityFilter, 'all'>;

export type ActivityFilterOption = {
  readonly value: ActivityFilter;
  readonly label: string;
  readonly count: number;
};

const LABEL: Readonly<Record<ActivityFilter, string>> = {
  all: 'All',
  people: 'People',
  bots: 'Bots',
  pushes: 'Pushes',
  checks: 'Checks',
};

const ORDER: ReadonlyArray<ActivityFilter> = ['all', 'people', 'bots', 'pushes', 'checks'];

type ItemParams = {
  readonly item: ActivityItem;
};

const lanesOf = ({ item }: ItemParams): ReadonlyArray<ActivityLane> => {
  switch (item.kind) {
    case 'bot':
      return ['bots'];
    case 'review':
      return [
        isBotLogin({ login: item.who, ...(item.isBot === undefined ? {} : { isBot: item.isBot }) })
          ? 'bots'
          : 'people',
      ];
    case 'comments':
      return [
        ...(item.hasPeople ? (['people'] as const) : []),
        ...(item.hasBots ? (['bots'] as const) : []),
      ];
    case 'push':
      return ['pushes'];
    case 'checks':
      return ['checks'];
    case 'opened':
    case 'edit':
    case 'merged':
    case 'closed':
      return ['people'];
    default: {
      const unreachable: never = item;
      return unreachable;
    }
  }
};

type FilterParams = {
  readonly items: ReadonlyArray<ActivityItem>;
  readonly filter: ActivityFilter;
};

export const activityItemsFor = ({ items, filter }: FilterParams): ReadonlyArray<ActivityItem> =>
  filter === 'all' ? items : items.filter((item) => lanesOf({ item }).includes(filter));

type OptionsParams = {
  readonly items: ReadonlyArray<ActivityItem>;
};

export const activityFilterOptionsOf = ({
  items,
}: OptionsParams): ReadonlyArray<ActivityFilterOption> =>
  ORDER.map((value) => ({
    value,
    label: LABEL[value],
    count: activityItemsFor({ items, filter: value }).length,
  })).filter((option) => option.value === 'all' || option.count > 0);

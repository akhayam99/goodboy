import { countNoun } from '../../utils/countNoun';
import type { ActivityItem } from './activityItem';

type Params = {
  readonly item: Extract<ActivityItem, { kind: 'push' }>;
};

export const pushLineOf = ({ item }: Params): string => {
  const commits = countNoun({ count: item.count, one: 'commit', many: 'commits' });
  return item.pushes > 1
    ? `pushed ${commits} in ${countNoun({ count: item.pushes, one: 'push', many: 'pushes' })}`
    : `pushed ${commits}`;
};

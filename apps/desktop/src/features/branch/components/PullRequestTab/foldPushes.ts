import type { ActivityItem } from './activityOf';

type Params = {
  readonly items: ReadonlyArray<ActivityItem>;
};

export const foldPushes = ({ items }: Params): ReadonlyArray<ActivityItem> =>
  items.reduce<ReadonlyArray<ActivityItem>>((folded, item) => {
    const last = folded[folded.length - 1];
    if (
      item.kind !== 'push' ||
      last === undefined ||
      last.kind !== 'push' ||
      last.who !== item.who
    ) {
      return [...folded, item];
    }
    return [
      ...folded.slice(0, -1),
      { ...last, at: item.at, sha: item.sha, count: last.count + item.count },
    ];
  }, []);

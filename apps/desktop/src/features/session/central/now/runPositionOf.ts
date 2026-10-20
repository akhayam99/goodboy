import type { LiveRunGroup } from './liveGroupsOf';

type Params = {
  readonly group: LiveRunGroup;
};

export const runPositionOf = ({ group }: Params): string | null => {
  const { started, total } = group.counts;
  if (started === 0) {
    return null;
  }
  return total === null ? `Step ${started}` : `Step ${Math.min(started, total)} of ${total}`;
};

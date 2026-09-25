import type { RailGroupInput } from '../../workTreeModel/railGeometry';
import type { TimelineRunEntry } from './buildTimelineGroups';
import type { TimelineStreamItem } from './buildTimelineStream';

export type TimelineLaneRuns = {
  readonly runByLaneId: ReadonlyMap<string, TimelineRunEntry>;
  readonly laneIdByRowId: ReadonlyMap<string, string>;
};

type Params = {
  readonly items: ReadonlyArray<TimelineStreamItem>;
  readonly groups: ReadonlyArray<RailGroupInput>;
};

export const timelineLaneRuns = ({ items, groups }: Params): TimelineLaneRuns => {
  const groupById = new Map(groups.map((group) => [group.id, group]));
  const runByRowId = new Map<string, TimelineRunEntry>();
  for (const item of items) {
    if (item.kind === 'row' && item.entry.kind === 'run') {
      runByRowId.set(item.id, item.entry);
    }
  }

  const runByLaneId = new Map<string, TimelineRunEntry>();
  const laneIdByRowId = new Map<string, string>();
  for (const group of groups) {
    if (group.parentGroupId !== null) {
      continue;
    }
    const run = runByRowId.get(group.originRowId);
    if (run === undefined) {
      continue;
    }
    runByLaneId.set(group.id, run);
    laneIdByRowId.set(group.originRowId, group.id);
  }

  const rootOf = ({ groupId }: { readonly groupId: string }): string | null => {
    let current = groupById.get(groupId);
    let hops = 0;
    while (current !== undefined && current.parentGroupId !== null && hops < groups.length) {
      current = groupById.get(current.parentGroupId);
      hops += 1;
    }
    return current === undefined ? null : current.id;
  };

  for (const item of items) {
    if (item.groupId === null) {
      continue;
    }
    const laneId = rootOf({ groupId: item.groupId });
    if (laneId !== null && runByLaneId.has(laneId)) {
      laneIdByRowId.set(item.id, laneId);
    }
  }

  return { runByLaneId, laneIdByRowId };
};

import type { MountId, SessionProjectMount } from '@goodboy/types';
import type { TimelineTopLevelEntry } from '../../timeline/buildTimelineGroups';
import { activityKindOf, type ActivityKind } from './activityKindOf';
import { activityMountIdsOf } from './activityMountIdsOf';

export type ActivityFilter = {
  readonly kind: ActivityKind | null;
  readonly mountIds: ReadonlySet<MountId>;
};

type Params = {
  readonly entry: TimelineTopLevelEntry;
  readonly filter: ActivityFilter;
  readonly mounts: ReadonlyArray<SessionProjectMount>;
};

export const activityEntryMatches = ({ entry, filter, mounts }: Params): boolean => {
  if (filter.kind !== null && activityKindOf({ entry }) !== filter.kind) {
    return false;
  }
  if (filter.mountIds.size === 0) {
    return true;
  }
  const entryMounts = activityMountIdsOf({ entry, mounts });
  return [...filter.mountIds].some((mountId) => entryMounts.has(mountId));
};

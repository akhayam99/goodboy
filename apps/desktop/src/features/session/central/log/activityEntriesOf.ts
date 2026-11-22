import type { MountId, SessionProjectMount } from '@goodboy/types';
import type {
  TimelineAgentEntry,
  TimelineArtifactEntry,
  TimelineEventEntry,
  TimelineLearningEntry,
  TimelinePlanEntry,
  TimelineRunEntry,
  TimelineTopLevelEntry,
} from '../../timeline/buildTimelineGroups';
import { activityEntryMatches, type ActivityFilter } from './activityEntryMatches';

type Params = {
  readonly entries: ReadonlyArray<TimelineTopLevelEntry>;
  readonly filter: ActivityFilter;
  readonly mounts: ReadonlyArray<SessionProjectMount>;
};

type AgentParams = {
  readonly entry: TimelineAgentEntry;
  readonly mountIds: ReadonlySet<MountId>;
};

type RunParams = {
  readonly entry: TimelineRunEntry;
  readonly mountIds: ReadonlySet<MountId>;
};

type EntryParams = {
  readonly entry: TimelineTopLevelEntry;
};

type NarrowParams = EntryParams & {
  readonly filter: ActivityFilter;
  readonly mounts: ReadonlyArray<SessionProjectMount>;
};

type AgentIdsParams = {
  readonly entry: TimelineAgentEntry;
};

type IdsParams = {
  readonly ids: ReadonlySet<string>;
};

type DetachParams = EntryParams & IdsParams;

type LaneEntry =
  TimelinePlanEntry | TimelineArtifactEntry | TimelineEventEntry | TimelineLearningEntry;

type LaunchEntry = TimelinePlanEntry | TimelineArtifactEntry | TimelineLearningEntry;

type LaneParams = IdsParams & {
  readonly entry: LaneEntry;
};

type LaunchParams = IdsParams & {
  readonly entry: LaunchEntry;
};

const agentInMountsOf = ({ entry, mountIds }: AgentParams): TimelineAgentEntry | null => {
  const children = entry.children.flatMap((child) => {
    const kept = agentInMountsOf({ entry: child, mountIds });
    return kept === null ? [] : [kept];
  });
  const isOwn = entry.agent.mountId !== undefined && mountIds.has(entry.agent.mountId);
  if (!isOwn && children.length === 0) {
    return null;
  }
  return children.length === entry.children.length ? entry : { ...entry, children };
};

const runInMountsOf = ({ entry, mountIds }: RunParams): TimelineRunEntry | null => {
  const children = entry.children.flatMap((child) => {
    if (child.kind !== 'agent') {
      return [];
    }
    const kept = agentInMountsOf({ entry: child, mountIds });
    return kept === null ? [] : [kept];
  });
  if (children.length === 0) {
    return null;
  }
  return children.length === entry.children.length ? entry : { ...entry, children };
};

const narrowedEntryOf = ({ entry, filter, mounts }: NarrowParams): TimelineTopLevelEntry | null => {
  if (!activityEntryMatches({ entry, filter, mounts })) {
    return null;
  }
  if (filter.mountIds.size === 0) {
    return entry;
  }
  if (entry.kind === 'agent') {
    return agentInMountsOf({ entry, mountIds: filter.mountIds });
  }
  if (entry.kind === 'run') {
    return runInMountsOf({ entry, mountIds: filter.mountIds });
  }
  return entry;
};

const agentIdsOf = ({ entry }: AgentIdsParams): ReadonlyArray<string> => [
  entry.id,
  ...entry.children.flatMap((child) => agentIdsOf({ entry: child })),
];

const entryIdsOf = ({ entry }: EntryParams): ReadonlyArray<string> => {
  if (entry.kind === 'agent') {
    return agentIdsOf({ entry });
  }
  if (entry.kind === 'run') {
    return [
      entry.id,
      ...entry.children.flatMap((child) =>
        child.kind === 'agent' ? agentIdsOf({ entry: child }) : [child.id],
      ),
    ];
  }
  return [entry.id];
};

const laneKeptOf = ({ entry, ids }: LaneParams): LaneEntry => {
  if (entry.lane === undefined || ids.has(entry.lane.rootEntryId)) {
    return entry;
  }
  const { lane: _detachedLane, ...detached } = entry;
  return detached;
};

const launchKeptOf = ({ entry, ids }: LaunchParams): LaunchEntry => {
  if (entry.launchEntryId === undefined || ids.has(entry.launchEntryId)) {
    return entry;
  }
  const { launchEntryId: _detachedLaunch, ...detached } = entry;
  return detached;
};

const detachedEntryOf = ({ entry, ids }: DetachParams): TimelineTopLevelEntry => {
  switch (entry.kind) {
    case 'question':
      return entry.lane !== null && !ids.has(entry.lane.rootEntryId)
        ? { ...entry, lane: null }
        : entry;
    case 'event':
      return laneKeptOf({ entry, ids });
    case 'plan':
    case 'artifact':
    case 'learning': {
      const laneKept = laneKeptOf({ entry, ids });
      return laneKept.kind === 'event' ? laneKept : launchKeptOf({ entry: laneKept, ids });
    }
    case 'agent':
    case 'run':
    case 'branch':
    case 'work':
    case 'issue':
      return entry;
    default: {
      const exhaustive: never = entry;
      return exhaustive;
    }
  }
};

export const activityEntriesOf = ({
  entries,
  filter,
  mounts,
}: Params): ReadonlyArray<TimelineTopLevelEntry> => {
  if (filter.kind === null && filter.mountIds.size === 0) {
    return entries;
  }
  const kept = entries.flatMap((entry) => {
    const narrowed = narrowedEntryOf({ entry, filter, mounts });
    return narrowed === null ? [] : [narrowed];
  });
  const ids = new Set(kept.flatMap((entry) => entryIdsOf({ entry })));
  return kept.map((entry) => detachedEntryOf({ entry, ids }));
};

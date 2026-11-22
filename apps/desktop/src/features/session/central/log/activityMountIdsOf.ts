import { brandId, type MountId, type SessionProjectMount } from '@goodboy/types';
import type { TimelineAgentEntry, TimelineTopLevelEntry } from '../../timeline/buildTimelineGroups';

type Params = {
  readonly entry: TimelineTopLevelEntry;
  readonly mounts: ReadonlyArray<SessionProjectMount>;
};

type AgentParams = {
  readonly entry: TimelineAgentEntry;
};

type PathParams = {
  readonly path: string | undefined;
  readonly mounts: ReadonlyArray<SessionProjectMount>;
};

const NO_MOUNTS: ReadonlyArray<MountId> = [];

const agentMountIdsOf = ({ entry }: AgentParams): ReadonlyArray<MountId> => [
  ...(entry.agent.mountId === undefined ? NO_MOUNTS : [entry.agent.mountId]),
  ...entry.children.flatMap((child) => agentMountIdsOf({ entry: child })),
];

const mountIdOfPath = ({ path, mounts }: PathParams): ReadonlyArray<MountId> => {
  if (path === undefined) {
    return NO_MOUNTS;
  }
  const mount = mounts.find(
    (candidate) => candidate.worktreePath === path || candidate.lastWorktreePath === path,
  );
  return mount === undefined ? NO_MOUNTS : [mount.mountId];
};

const mountIdsOf = ({ entry, mounts }: Params): ReadonlyArray<MountId> => {
  switch (entry.kind) {
    case 'agent':
      return agentMountIdsOf({ entry });
    case 'run':
      return entry.children.flatMap((child) =>
        child.kind === 'agent' ? agentMountIdsOf({ entry: child }) : NO_MOUNTS,
      );
    case 'branch':
      return [brandId<MountId>({ value: entry.worktree.id })];
    case 'work':
      return entry.work.mountId === null ? NO_MOUNTS : [entry.work.mountId];
    case 'event': {
      const payload = entry.event.payload;
      const mount = mounts.find((candidate) => candidate.mountId === payload?.mountId);
      if (mount !== undefined) {
        return [mount.mountId];
      }
      return mountIdOfPath({ path: payload?.worktreePath, mounts });
    }
    case 'plan':
    case 'artifact':
    case 'learning':
    case 'issue':
    case 'question':
      return NO_MOUNTS;
    default: {
      const exhaustive: never = entry;
      return exhaustive;
    }
  }
};

export const activityMountIdsOf = ({ entry, mounts }: Params): ReadonlySet<MountId> =>
  new Set(mountIdsOf({ entry, mounts }));

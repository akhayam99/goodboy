import {
  attributePorts,
  type AttributionProject,
  type AttributionSession,
  type PortRow,
} from '@goodboy/core';
import type { Project, SessionMountView } from '@goodboy/types';
import type { AppStore } from '../../store';

type Input = Pick<
  AppStore,
  | 'monitorSnapshot'
  | 'monitorLedger'
  | 'monitorScanned'
  | 'monitorLearned'
  | 'projects'
  | 'sessionMounts'
>;

const NO_ROWS: ReadonlyArray<PortRow> = [];

const isLiveMount = (mount: SessionMountView): boolean =>
  mount.worktreePath !== null && mount.diskState !== 'missing' && mount.diskState !== 'removed';

const sessionsOf = (
  mounts: Readonly<Record<string, ReadonlyArray<SessionMountView>>>,
): ReadonlyArray<AttributionSession> =>
  Object.entries(mounts).map(([id, list]) => ({
    id,
    worktrees: list.flatMap((mount) =>
      isLiveMount(mount) && mount.worktreePath !== null
        ? [{ path: mount.worktreePath, projectId: mount.projectId }]
        : [],
    ),
  }));

const projectsOf = (projects: ReadonlyArray<Project>): ReadonlyArray<AttributionProject> =>
  projects
    .filter((project) => project.disconnectedAt === undefined)
    .map((project) => ({ id: project.id, rootPath: project.rootPath }));

type Memo = {
  readonly input: Input;
  readonly rows: ReadonlyArray<PortRow>;
};

let memo: Memo | null = null;

const isSameInput = (a: Input, b: Input): boolean =>
  a.monitorSnapshot === b.monitorSnapshot &&
  a.monitorLedger === b.monitorLedger &&
  a.monitorScanned === b.monitorScanned &&
  a.monitorLearned === b.monitorLearned &&
  a.projects === b.projects &&
  a.sessionMounts === b.sessionMounts;

export const selectPortRows = (state: Input): ReadonlyArray<PortRow> => {
  if (memo !== null && isSameInput(memo.input, state)) {
    return memo.rows;
  }
  const snapshot = state.monitorSnapshot;
  if (snapshot === null) {
    return NO_ROWS;
  }
  const starred = new Set<string>(
    state.projects
      .filter((project) => project.starredAt !== undefined)
      .map((project) => project.id),
  );
  const rows = [
    ...attributePorts({
      snapshot,
      ledger: state.monitorLedger,
      sessions: sessionsOf(state.sessionMounts),
      projects: projectsOf(state.projects),
      watched: state.monitorScanned,
      learned: state.monitorLearned,
    }),
  ].sort((a, b) => {
    const aRank = a.projectId !== null && starred.has(a.projectId) ? 0 : 1;
    const bRank = b.projectId !== null && starred.has(b.projectId) ? 0 : 1;
    return aRank - bRank || a.port - b.port || a.key.localeCompare(b.key);
  });
  memo = { input: state, rows };
  return rows;
};

import {
  attributePorts,
  type AttributionProject,
  type AttributionSession,
  type PortRow,
} from '@goodboy/core/monitoring';
import type { Project } from '@goodboy/types';
import type { OwnedMount } from '../../../features/monitoring/ownedMountsOf';
import { selectOwnedMounts } from './selectOwnedMounts';
import type { AppStore } from '../../store';

type Input = Pick<
  AppStore,
  | 'monitorSnapshot'
  | 'monitorLedger'
  | 'monitorScanned'
  | 'monitorLearned'
  | 'projects'
  | 'sessionMounts'
  | 'sessionProjectMounts'
  | 'sessions'
>;

const NO_ROWS: ReadonlyArray<PortRow> = [];

const sessionsOf = (mounts: ReadonlyArray<OwnedMount>): ReadonlyArray<AttributionSession> => {
  const bySession = new Map<string, Array<{ path: string; projectId: string | null }>>();
  for (const mount of mounts) {
    if (!mount.isLive) {
      continue;
    }
    const list = bySession.get(mount.sessionId) ?? [];
    list.push({ path: mount.worktreePath, projectId: mount.projectId });
    bySession.set(mount.sessionId, list);
  }
  return [...bySession.entries()].map(([id, worktrees]) => ({ id, worktrees }));
};

const projectsOf = (projects: ReadonlyArray<Project>): ReadonlyArray<AttributionProject> =>
  projects
    .filter((project) => project.disconnectedAt === undefined)
    .map((project) => ({ id: project.id, rootPath: project.rootPath }));

type Memo = {
  readonly input: Input;
  readonly mounts: ReadonlyArray<OwnedMount>;
  readonly rows: ReadonlyArray<PortRow>;
};

let memo: Memo | null = null;

const isSameInput = (a: Input, b: Input): boolean =>
  a.monitorSnapshot === b.monitorSnapshot &&
  a.monitorLedger === b.monitorLedger &&
  a.monitorScanned === b.monitorScanned &&
  a.monitorLearned === b.monitorLearned &&
  a.projects === b.projects;

export const selectPortRows = (state: Input): ReadonlyArray<PortRow> => {
  const mounts = selectOwnedMounts({ state });
  if (memo !== null && memo.mounts === mounts && isSameInput(memo.input, state)) {
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
      sessions: sessionsOf(mounts),
      projects: projectsOf(state.projects),
      watched: state.monitorScanned,
      learned: state.monitorLearned,
    }),
  ].sort((a, b) => {
    const aRank = a.projectId !== null && starred.has(a.projectId) ? 0 : 1;
    const bRank = b.projectId !== null && starred.has(b.projectId) ? 0 : 1;
    return aRank - bRank || a.port - b.port || a.key.localeCompare(b.key);
  });
  memo = { input: state, mounts, rows };
  return rows;
};

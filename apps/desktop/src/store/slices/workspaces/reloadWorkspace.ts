import type { Agent, SessionExternalTask, WorkspaceId } from '@goodboy/types';
import {
  listAgentsForSessions,
  listExternalTasksForWorkspace,
  listProjectsForWorkspace,
  listSessionsForWorkspace,
  listWorktreesForSessions,
} from '@goodboy/db';
import type { SessionWorktree } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { createLatestOnly } from '../../runtime/state-writes/latestOnly';
import { buildSessionProjectMounts } from '../worktrees/buildSessionProjectMounts';
import { verifyAvailableWorktrees } from '../project-mounts/verifyAvailableWorktrees';
import { switchEpoch } from './switchEpoch';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
};

type Input = {
  readonly workspaceId: WorkspaceId;
};

export const reloadWorkspace = ({ set, get }: Params) => {
  const latest = createLatestOnly();
  return async ({ workspaceId }: Input): Promise<void> => {
    const claimed = latest.claim({ key: workspaceId });
    const epoch = switchEpoch.value;
    const projects = await listProjectsForWorkspace({ db: tauriDatabase, workspaceId });
    const loaded = await listSessionsForWorkspace(tauriDatabase, workspaceId);
    const known = new Set(get().sessions.map((session) => session.id));
    const added = loaded.filter((session) => !known.has(session.id));
    const addedIds = added.map((session) => session.id);
    const [worktreesBySession, agentsBySession, externalTasks] = await Promise.all([
      listWorktreesForSessions(
        tauriDatabase,
        loaded.map((session) => session.id),
      ),
      listAgentsForSessions(tauriDatabase, addedIds),
      listExternalTasksForWorkspace({ db: tauriDatabase, workspaceId }),
    ]);
    const records: Record<string, ReadonlyArray<SessionWorktree>> = {};
    const mounts: Record<string, ReturnType<typeof buildSessionProjectMounts>> = {};
    for (const session of loaded) {
      const { available } = await verifyAvailableWorktrees({
        sessionId: session.id,
        candidates: worktreesBySession.get(session.id) ?? [],
        projects,
      });
      records[session.id] = available;
      mounts[session.id] = buildSessionProjectMounts({ projects, rows: available });
    }
    if (!claimed.isCurrent() || epoch !== switchEpoch.value) {
      return;
    }
    const phaseRuns: Record<string, ReadonlyArray<Agent>> = {};
    for (const id of addedIds) {
      phaseRuns[id] = agentsBySession.get(id) ?? [];
    }
    const tasks: Record<string, ReadonlyArray<SessionExternalTask>> = {};
    for (const session of loaded) {
      tasks[session.id] = externalTasks.filter((task) => task.sessionId === session.id);
    }
    set((state) => {
      const stillKnown = new Set(state.sessions.map((session) => session.id));
      return {
        projects: [
          ...state.projects.filter((project) => project.workspaceId !== workspaceId),
          ...projects,
        ],
        sessions: [...state.sessions, ...added.filter((session) => !stillKnown.has(session.id))],
        sessionWorktreeRecords: { ...state.sessionWorktreeRecords, ...records },
        sessionProjectMounts: { ...state.sessionProjectMounts, ...mounts },
        sessionPhaseRuns: { ...state.sessionPhaseRuns, ...phaseRuns },
        sessionExternalTasks: { ...state.sessionExternalTasks, ...tasks },
      };
    });
  };
};

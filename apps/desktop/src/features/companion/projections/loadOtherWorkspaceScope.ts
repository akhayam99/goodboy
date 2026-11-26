import type { SessionExternalTask, SessionId, Workspace } from '@goodboy/types';
import {
  getWorkspaceValue,
  listAgentsForSessions,
  listContextSlotsForSession,
  listExternalTasksForWorkspace,
  listOpenQuestionsForSessions,
  listProjectsForWorkspace,
  listSessionsForWorkspace,
  type Database,
} from '@goodboy/db';
import { listWorkspacePullRequestLinks } from '@goodboy/db/mount-pr-link';
import { isLiveSession } from './isLiveSession';
import { sessionGithubOf } from './sessionGithubOf';
import { scopeOfState, type ScopeState } from './scopeOfState';
import type { WorkspaceScope } from './workspaceScope';

type Params = {
  readonly db: Database;
  readonly workspace: Pick<Workspace, 'id' | 'name'>;
  readonly base: ScopeState;
};

type GroupParams<T> = {
  readonly items: ReadonlyArray<T>;
};

const groupBySession = <T extends { readonly sessionId: SessionId }>({
  items,
}: GroupParams<T>): Record<string, ReadonlyArray<T>> => {
  const grouped: Record<string, T[]> = {};
  for (const item of items) {
    grouped[item.sessionId] = [...(grouped[item.sessionId] ?? []), item];
  }
  return grouped;
};

export const loadOtherWorkspaceScope = async ({
  db,
  workspace,
  base,
}: Params): Promise<WorkspaceScope> => {
  const sessions = await listSessionsForWorkspace(db, workspace.id);
  const sessionIds = sessions.map((session) => session.id);
  const live = sessions.filter((session) => isLiveSession({ session }));
  const [questions, agents, projects, tasks, links, slots, levelRaw] = await Promise.all([
    listOpenQuestionsForSessions({ db, sessionIds }),
    listAgentsForSessions(db, sessionIds),
    listProjectsForWorkspace({ db, workspaceId: workspace.id }),
    listExternalTasksForWorkspace({ db, workspaceId: workspace.id }),
    listWorkspacePullRequestLinks({ db, workspaceId: workspace.id }),
    Promise.all(live.map((session) => listContextSlotsForSession(db, session.id))),
    getWorkspaceValue({ db, workspaceId: workspace.id, key: 'auto.level' }),
  ]);
  const state: ScopeState = {
    ...base,
    sessions,
    projects,
    sessionOpenQuestions: groupBySession({ items: questions }),
    sessionPhaseRuns: Object.fromEntries(agents),
    sessionExternalTasks: groupBySession<SessionExternalTask>({ items: tasks }),
    sessionProjectMounts: {},
    sessionGithub: sessionGithubOf({ links }),
    sessionResolveThreads: {},
    sessionSlots: Object.fromEntries(
      live.map((session, index) => [session.id, slots[index] ?? []]),
    ),
    workspaceValues: {
      ...base.workspaceValues,
      [workspace.id]: levelRaw === null ? {} : { 'auto.level': levelRaw },
    },
  };
  return scopeOfState({ workspace, state, sessions, isFullyLoaded: false });
};

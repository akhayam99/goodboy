import type { Project, Session, SessionExternalTask, SessionId, Workspace } from '@goodboy/types';
import {
  getWorkspaceValue,
  listAgentsForSessions,
  listContextSlotsForSession,
  listExternalTasksForWorkspace,
  listOpenQuestionsForSessions,
  listProjectsForWorkspace,
  listResolveThreads,
  listSessionMounts,
  listSessionsForWorkspace,
  type Database,
} from '@goodboy/db';
import {
  listMountPullRequestLinks,
  listWorkspacePullRequestLinks,
} from '@goodboy/db/mount-pr-link';
import { mountViewOf } from '../../../store/slices/project-mounts/mountViews';
import { canonicalPullRequestLinkOf } from '../../../store/slices/project-mounts/workRecord/canonicalPullRequestLinkOf';
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

type SettleFactsParams = {
  readonly db: Database;
  readonly session: Session;
  readonly projects: ReadonlyArray<Project>;
};

const settleFactsOf = async ({ db, session, projects }: SettleFactsParams) => {
  const [mounts, threads] = await Promise.all([
    listSessionMounts({ db, sessionId: session.id }),
    listResolveThreads({ db, sessionId: session.id }),
  ]);
  const views = mounts.flatMap((mount) => {
    const view = mountViewOf({ mount, projects });
    return view === null ? [] : [view];
  });
  const linkLists = await Promise.all(
    views.map((view) => listMountPullRequestLinks({ db, sessionId: session.id, mountId: view.id })),
  );
  const links = linkLists.flatMap((list) => {
    const link = canonicalPullRequestLinkOf({ links: list });
    return link === null ? [] : [link];
  });
  return { sessionId: session.id, views, threads, links };
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
  const settleFacts = await Promise.all(
    live.map((session) => settleFactsOf({ db, session, projects })),
  );
  const state: ScopeState = {
    ...base,
    sessions,
    projects,
    sessionOpenQuestions: groupBySession({ items: questions }),
    sessionPhaseRuns: Object.fromEntries(agents),
    sessionExternalTasks: groupBySession<SessionExternalTask>({ items: tasks }),
    sessionProjectMounts: {},
    sessionMounts: Object.fromEntries(settleFacts.map((facts) => [facts.sessionId, facts.views])),
    mountPrLinks: Object.fromEntries(
      settleFacts.flatMap((facts) => facts.links.map((link) => [link.mountId, link])),
    ),
    sessionGithub: sessionGithubOf({ links }),
    sessionResolveThreads: Object.fromEntries(
      settleFacts.map((facts) => [facts.sessionId, facts.threads]),
    ),
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

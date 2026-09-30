// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectId, SessionId, WorkspaceId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  buildStoryProject,
  buildStorySession,
  buildStoryWorkspace,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from './storyHarness';
import { projectById } from './slices/projects/projectIndex';
import { selectProjectById } from './slices/projects/selectProjectById';
import { selectSessionById } from './slices/sessions/selectSessionById';
import { sessionById } from './slices/sessions/sessionIndex';

vi.mock('@tauri-apps/api/core', async () => (await import('./storyHarness')).tauriCoreModuleMock());
vi.mock('@tauri-apps/api/event', async () =>
  (await import('./storyHarness')).tauriEventModuleMock(),
);
vi.mock('../shared/lib/db', async () => (await import('./storyHarness')).dbLibModuleMock());
const projectWrites = vi.hoisted(() => ({
  updateProjectStar: vi.fn(async () => undefined),
  updateProjectBaseBranch: vi.fn(async () => undefined),
}));

vi.mock('@goodboy/db', async () => (await import('./storyHarness')).dbModuleMock(projectWrites));
vi.mock('../features/chat/turn', async () => (await import('./storyHarness')).turnModuleMock());
vi.mock('../features/permissions/permissions', async () =>
  (await import('./storyHarness')).permissionsModuleMock(),
);
vi.mock('../features/providers/providers', async () =>
  (await import('./storyHarness')).providersModuleMock(),
);
vi.mock('../features/providers/routing', async () =>
  (await import('./storyHarness')).routingModuleMock(),
);
vi.mock('../features/budget/budget', async () =>
  (await import('./storyHarness')).budgetModuleMock(),
);
vi.mock('../features/skills/skills', async () =>
  (await import('./storyHarness')).skillsModuleMock(),
);
vi.mock('../features/workflows/workflows', async () =>
  (await import('./storyHarness')).workflowsModuleMock(),
);
vi.mock('../features/worktree/worktree', async () =>
  (await import('./storyHarness')).worktreeModuleMock(),
);
vi.mock('../shared/lib/repo', async () => (await import('./storyHarness')).repoModuleMock());

const WS_A = 'workspace-a' as WorkspaceId;
const WS_B = 'workspace-b' as WorkspaceId;
const SESSION_LEDGER = 'session-ledger' as SessionId;
const SESSION_NOTIFY = 'session-notify' as SessionId;
const SESSION_STORE = 'session-storefront' as SessionId;
const SESSION_GHOST = 'session-ghost' as SessionId;
const PROJECT_LEDGER = 'project-ledger' as ProjectId;
const PROJECT_NOTIFY = 'project-notify' as ProjectId;
const PROJECT_STORE = 'project-storefront' as ProjectId;
const PROJECT_GHOST = 'project-ghost' as ProjectId;

const aLedgerSession = () =>
  buildStorySession({ id: SESSION_LEDGER, workspaceId: WS_A, goal: 'ledger-core rollup' });
const aNotifySession = () =>
  buildStorySession({ id: SESSION_NOTIFY, workspaceId: WS_A, goal: 'notify-relay retries' });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

type Audit = {
  readonly checks: () => number;
  readonly stop: () => void;
};

const auditIndexesOnEveryWrite = (): Audit => {
  const audit = { count: 0 };
  const verify = () => {
    const state = useAppStore.getState();
    for (const session of state.sessions) {
      const expected = state.sessions.find((candidate) => candidate.id === session.id);
      expect(sessionById(state.sessions, session.id)).toBe(expected);
      expect(selectSessionById(state, session.id)).toBe(expected);
    }
    for (const archived of Object.values(state.archivedSessions)) {
      for (const session of archived) {
        expect(selectSessionById(state, session.id)).toBe(
          state.sessions.find((candidate) => candidate.id === session.id) ??
            archived.find((candidate) => candidate.id === session.id),
        );
      }
    }
    expect(sessionById(state.sessions, SESSION_GHOST)).toBeUndefined();
    expect(selectSessionById(state, SESSION_GHOST)).toBeNull();
    for (const project of state.projects) {
      const expected = state.projects.find((candidate) => candidate.id === project.id);
      expect(projectById(state.projects, project.id)).toBe(expected);
      expect(selectProjectById(state, project.id)).toBe(expected);
    }
    expect(projectById(state.projects, PROJECT_GHOST)).toBeUndefined();
    expect(selectProjectById(state, PROJECT_GHOST)).toBeNull();
    audit.count += 1;
  };
  const stop = useAppStore.subscribe(verify);
  return { checks: () => audit.count, stop };
};

describe('lookups by id follow every write to sessions and projects', () => {
  let audit: Audit;

  beforeEach(async () => {
    await resetStoryStore();
    useAppStore.setState({
      workspaces: [buildStoryWorkspace({ id: WS_A }), buildStoryWorkspace({ id: WS_B })],
      currentWorkspaceId: WS_A,
      sessions: [aLedgerSession(), aNotifySession()],
      projects: [
        buildStoryProject({ id: PROJECT_LEDGER, workspaceId: WS_A, name: 'ledger-core' }),
        buildStoryProject({ id: PROJECT_NOTIFY, workspaceId: WS_A, name: 'notify-relay' }),
      ],
    });
    audit = auditIndexesOnEveryWrite();
  });

  afterEach(() => {
    audit.stop();
  });

  it('sees a rename that keeps the list the same length', async () => {
    const before = useAppStore.getState().sessions;
    await useAppStore.getState().renameTask(SESSION_LEDGER, 'ledger-core audit');

    const after = useAppStore.getState().sessions;
    expect(after).not.toBe(before);
    expect(after).toHaveLength(before.length);
    expect(sessionById(after, SESSION_LEDGER)?.goal).toBe('ledger-core audit');
    expect(sessionById(after, SESSION_NOTIFY)).toBe(before[1]);
    expect(audit.checks()).toBeGreaterThan(0);
  });

  it.each([
    [
      'setSessionPermissionMode',
      () => useAppStore.getState().setSessionPermissionMode(SESSION_NOTIFY, 'default'),
    ],
    ['setSessionAutoRun', () => useAppStore.getState().setSessionAutoRun(SESSION_NOTIFY, true)],
    [
      'setSessionConfig',
      () => useAppStore.getState().setSessionConfig(SESSION_NOTIFY, { verbosity: 'brief' }),
    ],
  ])('sees %s replace the session row', async (_name, act) => {
    const before = sessionById(useAppStore.getState().sessions, SESSION_NOTIFY);
    await act();

    const after = sessionById(useAppStore.getState().sessions, SESSION_NOTIFY);
    expect(after).toBeDefined();
    expect(after).not.toBe(before);
    expect(after?.id).toBe(SESSION_NOTIFY);
    expect(audit.checks()).toBeGreaterThan(0);
  });

  it('moves a session to the archived pool and back', async () => {
    await useAppStore.getState().archiveTask(SESSION_LEDGER);
    const state = useAppStore.getState();
    expect(sessionById(state.sessions, SESSION_LEDGER)).toBeUndefined();
    expect(selectSessionById(state, SESSION_LEDGER)?.archivedAt).toBeDefined();

    await useAppStore.getState().unarchiveTask(SESSION_LEDGER);
    const restored = useAppStore.getState();
    expect(sessionById(restored.sessions, SESSION_LEDGER)?.archivedAt).toBeUndefined();
    expect(audit.checks()).toBeGreaterThan(1);
  });

  it('drops a deleted session from the index', async () => {
    await useAppStore.getState().deleteTask(SESSION_NOTIFY);

    const state = useAppStore.getState();
    expect(sessionById(state.sessions, SESSION_NOTIFY)).toBeUndefined();
    expect(selectSessionById(state, SESSION_NOTIFY)).toBeNull();
    expect(sessionById(state.sessions, SESSION_LEDGER)).toBeDefined();
    expect(audit.checks()).toBeGreaterThan(0);
  });

  it('rebuilds both indexes when the workspace switch replaces the lists', async () => {
    const db = await import('@goodboy/db');
    vi.mocked(db.listSessionsForWorkspace).mockResolvedValue([
      buildStorySession({ id: SESSION_STORE, workspaceId: WS_B, goal: 'storefront-web polish' }),
    ]);
    storySpies.getWorkspaceById.mockResolvedValue(buildStoryWorkspace({ id: WS_B }));
    storySpies.listProjectsForWorkspace.mockResolvedValue([
      buildStoryProject({ id: PROJECT_STORE, workspaceId: WS_B, name: 'storefront-web' }),
    ]);

    await useAppStore.getState().setCurrentWorkspace(WS_B);

    const state = useAppStore.getState();
    expect(sessionById(state.sessions, SESSION_LEDGER)).toBeUndefined();
    expect(sessionById(state.sessions, SESSION_STORE)?.goal).toBe('storefront-web polish');
    expect(projectById(state.projects, PROJECT_STORE)?.name).toBe('storefront-web');
    expect(projectById(state.projects, PROJECT_LEDGER)?.name).toBe('ledger-core');
    expect(audit.checks()).toBeGreaterThan(1);
  });

  it('sees project writes that keep the list the same length', async () => {
    const before = useAppStore.getState().projects;
    await useAppStore.getState().setProjectStarred({ projectId: PROJECT_LEDGER, isStarred: true });
    await useAppStore
      .getState()
      .updateProjectBaseBranch({ projectId: PROJECT_NOTIFY, baseBranch: 'develop' });

    const after = useAppStore.getState().projects;
    expect(after).not.toBe(before);
    expect(after).toHaveLength(before.length);
    expect(projectById(after, PROJECT_LEDGER)?.starredAt).toBeDefined();
    expect(projectById(after, PROJECT_NOTIFY)?.baseBranch).toBe('develop');
    expect(audit.checks()).toBeGreaterThan(1);
  });

  it('keeps the same rows when an unrelated key changes', () => {
    const { sessions, projects } = useAppStore.getState();
    const ledger = sessionById(sessions, SESSION_LEDGER);
    const project = projectById(projects, PROJECT_LEDGER);

    useAppStore.setState({ boardReady: true });

    const next = useAppStore.getState();
    expect(next.sessions).toBe(sessions);
    expect(next.projects).toBe(projects);
    expect(sessionById(next.sessions, SESSION_LEDGER)).toBe(ledger);
    expect(projectById(next.projects, PROJECT_LEDGER)).toBe(project);
  });
});

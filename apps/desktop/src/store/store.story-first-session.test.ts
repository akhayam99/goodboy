import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentId, ProjectId, WorkspaceId } from '@goodboy/types';
import {
  assistantTurnStream,
  buildStoryAgent,
  buildStoryProject,
  buildStoryWorkspace,
  connectedAnthropicState,
  emptyTurnStream,
  recordedEvent,
  recordedEventKinds,
  resetStorySpies,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  type StoryStore,
} from './storyHarness';

vi.mock('@tauri-apps/api/core', async () => (await import('./storyHarness')).tauriCoreModuleMock());
vi.mock('@tauri-apps/api/event', async () =>
  (await import('./storyHarness')).tauriEventModuleMock(),
);
vi.mock('../shared/lib/db', async () => (await import('./storyHarness')).dbLibModuleMock());
vi.mock('@goodboy/db', async () => (await import('./storyHarness')).dbModuleMock());
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

const WORKSPACE_ID = 'workspace-first' as WorkspaceId;
const PROJECT_ID = 'project-app' as ProjectId;

const workspace = buildStoryWorkspace({ id: WORKSPACE_ID });
const project = buildStoryProject({ id: PROJECT_ID, workspaceId: WORKSPACE_ID });

let useAppStore: StoryStore;

const freshWorkspaceState = () => ({
  workspaces: [workspace],
  currentWorkspaceId: WORKSPACE_ID,
  projects: [project],
  sessions: [],
  archivedSessions: {},
  ...connectedAnthropicState(),
});

const spawnedArgs = (): Record<string, unknown> =>
  (storySpies.runTurn.mock.calls[0]?.[0] ?? {}) as Record<string, unknown>;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(() => {
  resetStorySpies();
  storySpies.runTurn.mockImplementation(() => emptyTurnStream());
  storySpies.getWorkspaceById.mockResolvedValue(workspace as never);
  storySpies.listProjectsForWorkspace.mockResolvedValue([project] as never);
  useAppStore.setState(freshWorkspaceState() as never);
});

const MOUNT_PATH = '/tmp/app/.goodboy/worktrees/untitled-session';
const MOUNT_BRANCH = 'goodboy/untitled-session';

const primeMount = () => {
  storySpies.createWorktree.mockResolvedValueOnce({
    worktreePath: MOUNT_PATH,
    branchName: MOUNT_BRANCH,
    slug: 'untitled-session',
    reused: false,
  } as never);
};

describe('story: a first-run user opens their workspace and starts a session', () => {
  it('New session opens a draft and writes nothing', () => {
    useAppStore.getState().openSessionDraft();

    const state = useAppStore.getState();
    expect(state.sessions).toEqual([]);
    expect(state.currentSessionId).toBeNull();
    expect(state.openSessionDraftWorkspaceId).toBe(WORKSPACE_ID);
    expect(storySpies.createWorktree).not.toHaveBeenCalled();
    expect(storySpies.createSessionDir).not.toHaveBeenCalled();
    expect(recordedEventKinds()).toEqual([]);
  });

  it('Start creates the session with nothing mounted', async () => {
    useAppStore.getState().openSessionDraft();
    const session = await useAppStore.getState().startSessionFromDraft({
      workspaceId: WORKSPACE_ID,
      start: {
        kind: 'task',
        candidate: {
          provider: 'linear',
          externalId: 'issue-214',
          identifier: 'NW-214',
          title: 'Invoices credited twice',
          url: 'https://linear.app/northwind/issue/NW-214',
          goal: 'Stop crediting an invoice twice.',
          body: '',
          branchSlug: 'invoices-credited-twice',
        },
        title: 'Invoices credited twice',
        goal: 'Stop crediting an invoice twice.',
      },
    });

    const state = useAppStore.getState();
    expect(state.sessions.map((candidate) => candidate.id)).toContain(session.id);
    expect(state.currentSessionId).toBe(session.id);
    expect(state.openSessionDraftWorkspaceId).toBeNull();
    expect(session.goal).toBe('Invoices credited twice');
    expect(state.sessionSlots[session.id]).toEqual([
      { key: 'goal', value: 'Stop crediting an invoice twice.', enabled: true },
    ]);
    expect(state.sessionExternalTasks[session.id]?.map((task) => task.identifier)).toEqual([
      'NW-214',
    ]);
    expect(storySpies.createWorktree).not.toHaveBeenCalled();
    expect(state.sessionWorktrees[session.id]).toEqual([]);
    expect(state.sessionProjectMounts[session.id]).toEqual([]);
  });

  it('the first read turn runs from the scratch standpoint, mounting nothing', async () => {
    const { session } = await useAppStore
      .getState()
      .createSession({ workspaceId: WORKSPACE_ID, goal: 'Look around', omitGoalSlot: true });
    const agent = buildStoryAgent({ id: 'agent-first' as AgentId, sessionId: session.id });
    useAppStore.setState({
      sessionPhaseRuns: { [session.id]: [agent] },
      selectedAgentId: { [session.id]: agent.id },
    } as never);

    await useAppStore.getState().sendTurn({ sessionId: session.id, content: 'scan the codebase' });

    expect(storySpies.insertSessionWorktree).not.toHaveBeenCalled();
    expect(recordedEventKinds()).toEqual([]);
    expect(storySpies.scratchDirPrepare).toHaveBeenCalledWith({ sessionId: session.id });

    const systemPrompt = String(spawnedArgs()['systemPrompt']);
    expect(systemPrompt).toContain('[projects-scope]');
    expect(systemPrompt).toContain('app (repo) root: /tmp/app | NOT materialized');
    expect(systemPrompt).toContain('ephemeral scratch directory');
  });

  it('a second read turn still creates no worktree', async () => {
    const { session } = await useAppStore
      .getState()
      .createSession({ workspaceId: WORKSPACE_ID, goal: 'Look around', omitGoalSlot: true });
    const agent = buildStoryAgent({ id: 'agent-again' as AgentId, sessionId: session.id });
    useAppStore.setState({
      sessionPhaseRuns: { [session.id]: [agent] },
      selectedAgentId: { [session.id]: agent.id },
    } as never);
    storySpies.runTurn.mockImplementation(assistantTurnStream('done scanning'));

    await useAppStore.getState().sendTurn({ sessionId: session.id, content: 'first look' });
    await useAppStore.getState().sendTurn({ sessionId: session.id, content: 'keep going' });

    expect(storySpies.createWorktree).not.toHaveBeenCalled();
    expect(recordedEventKinds()).toEqual([]);
  });
});

describe('story: a session seeded from a GitHub issue', () => {
  it('records the mount and the external task, and owns exactly one worktree', async () => {
    primeMount();

    const { session } = await useAppStore.getState().createSession({
      workspaceId: WORKSPACE_ID,
      projectId: PROJECT_ID,
      goal: 'Fix the login redirect',
      externalTasks: [
        {
          provider: 'github',
          externalId: '123',
          identifier: '#123',
          url: 'https://github.com/acme/app/issues/123',
          title: 'Login redirect loops',
        },
      ],
    });

    expect(session.goal).toBe('Fix the login redirect');
    expect(recordedEventKinds()).toEqual(['project_materialized', 'external_task_created']);
    expect(recordedEvent('external_task_created')?.payload).toMatchObject({
      provider: 'github',
      identifier: '#123',
      title: 'Login redirect loops',
    });
    expect(
      useAppStore.getState().sessionExternalTasks[session.id]?.map((task) => task.identifier),
    ).toEqual(['#123']);

    expect(storySpies.insertSessionWorktree).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().sessionWorktrees[session.id]).toEqual([MOUNT_PATH]);
  });
});

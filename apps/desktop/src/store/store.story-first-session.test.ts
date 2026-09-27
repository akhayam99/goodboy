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
  it('New session creates a blank session with nothing required and nothing mounted', async () => {
    const session = await useAppStore.getState().startBlankSession();

    const state = useAppStore.getState();
    expect(session).not.toBeNull();
    expect(state.sessions.map((candidate) => candidate.id)).toEqual([session?.id]);
    expect(state.currentSessionId).toBe(session?.id);
    expect(state.activeLens[session!.id] ?? null).toBeNull();
    expect(session?.goal).toBe('');
    expect(state.sessionSlots[session!.id]).toEqual([]);
    expect(state.sessionPhaseRuns[session!.id]).toEqual([]);
    expect(state.sessionProjectMounts[session!.id]).toEqual([]);
    expect(storySpies.createWorktree).not.toHaveBeenCalled();
    expect(recordedEventKinds()).toEqual([]);
  });

  it('New session again reuses the untouched blank session instead of piling up another', async () => {
    const first = await useAppStore.getState().startBlankSession();
    const second = await useAppStore.getState().startBlankSession();

    expect(second?.id).toBe(first?.id);
    expect(useAppStore.getState().sessions).toHaveLength(1);
  });

  it('the goal step names an untitled session from the goal and keeps the goal', async () => {
    const session = await useAppStore.getState().startBlankSession();

    await useAppStore.getState().saveSessionSetupGoal({
      sessionId: session!.id,
      goal: 'Stop crediting an invoice twice. Then reconcile last week.',
    });

    const state = useAppStore.getState();
    const saved = state.sessions.find((candidate) => candidate.id === session!.id);
    expect(saved?.goal).toBe('Stop crediting an invoice twice.');
    expect(saved?.titleUserEdited).toBe(false);
    expect(state.goodboyNamedSessionId).toBe(session!.id);
    expect(state.sessionSlots[session!.id]?.find((slot) => slot.key === 'goal')?.value).toBe(
      'Stop crediting an invoice twice. Then reconcile last week.',
    );

    const next = await useAppStore.getState().startBlankSession();
    expect(next?.id).not.toBe(session!.id);
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

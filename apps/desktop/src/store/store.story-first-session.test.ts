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
vi.mock('../features/workspace/prepareSessionContainer', async () =>
  (await import('./storyHarness')).prepareSessionContainerModuleMock(),
);
vi.mock('../shared/lib/repo', async () => (await import('./storyHarness')).repoModuleMock());

const WORKSPACE_ID = 'workspace-first' as WorkspaceId;
const PROJECT_ID = 'project-app' as ProjectId;

const workspace = buildStoryWorkspace({ id: WORKSPACE_ID });
const project = buildStoryProject({ id: PROJECT_ID, workspaceId: WORKSPACE_ID });

type StoreModule = typeof import('./store');
let useAppStore: StoreModule['useAppStore'];

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
  ({ useAppStore } = await import('./store'));
}, 60_000);

beforeEach(() => {
  resetStorySpies();
  storySpies.runTurn.mockImplementation(() => emptyTurnStream());
  storySpies.getWorkspaceById.mockResolvedValue(workspace as never);
  storySpies.listProjectsForWorkspace.mockResolvedValue([project] as never);
  useAppStore.setState(freshWorkspaceState() as never);
});

describe('story: a first-run user opens their workspace and starts a session', () => {
  it('New session lands on the board instantly, before any file or event exists', async () => {
    const { session } = await useAppStore
      .getState()
      .createUntitledSession({ workspaceId: WORKSPACE_ID });

    const state = useAppStore.getState();
    expect(state.sessions.map((candidate) => candidate.id)).toContain(session.id);
    expect(session.goal).toBe('Untitled session');
    expect(state.currentSessionId).toBe(session.id);
    expect(state.pendingTitleFocusSessionId).toBe(session.id);

    expect(storySpies.prepareSessionContainer).not.toHaveBeenCalled();
    expect(storySpies.createWorktree).not.toHaveBeenCalled();
    expect(storySpies.createSessionDir).not.toHaveBeenCalled();
    expect(storySpies.writeSessionMarker).not.toHaveBeenCalled();
    expect(storySpies.insertSessionWorktree).not.toHaveBeenCalled();
    expect(storySpies.insertSessionEvent).not.toHaveBeenCalled();

    expect(state.sessionWorktrees[session.id]).toEqual([]);
    expect(state.sessionProjectMounts[session.id]).toEqual([]);
    expect(state.sessionBranches[session.id]).toBe('');
  });

  it('the first agent turn materializes the container once, and nothing else', async () => {
    const { session } = await useAppStore
      .getState()
      .createUntitledSession({ workspaceId: WORKSPACE_ID });
    const agent = buildStoryAgent({ id: 'agent-first' as AgentId, sessionId: session.id });
    useAppStore.setState({
      sessionPhaseRuns: { [session.id]: [agent] },
      selectedAgentId: { [session.id]: agent.id },
    } as never);

    await useAppStore.getState().sendTurn({ sessionId: session.id, content: 'scan the codebase' });

    expect(storySpies.prepareSessionContainer).toHaveBeenCalledTimes(1);
    const containerDir = useAppStore.getState().sessionWorktrees[session.id]?.[0] ?? '';
    expect(containerDir).toContain('/.goodboy/sessions/acme/untitled-session-');
    expect(storySpies.writeSessionMarker).toHaveBeenCalledWith(
      expect.objectContaining({ path: containerDir, sessionId: session.id }),
    );
    expect(storySpies.insertSessionWorktree).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ worktreePath: containerDir, branch: '', parallelIndex: 0 }),
    );
    expect(recordedEventKinds()).toEqual(['worktree_created']);

    expect(storySpies.createWorktree).not.toHaveBeenCalled();
    expect(useAppStore.getState().sessionProjectMounts[session.id]).toEqual([]);
    expect(useAppStore.getState().sessionBranches[session.id]).toBe('');

    expect(spawnedArgs()['workingDir']).toBe(containerDir);
    const systemPrompt = String(spawnedArgs()['systemPrompt']);
    expect(systemPrompt).toContain('[workspace-scope]');
    expect(systemPrompt).toContain('app (repo) root: /tmp/app');
    expect(systemPrompt).toContain('NOT materialized');
    expect(systemPrompt).toContain('No project is materialized yet');
  });

  it('a second turn reuses the container instead of preparing it again', async () => {
    const { session } = await useAppStore
      .getState()
      .createUntitledSession({ workspaceId: WORKSPACE_ID });
    const agent = buildStoryAgent({ id: 'agent-again' as AgentId, sessionId: session.id });
    useAppStore.setState({
      sessionPhaseRuns: { [session.id]: [agent] },
      selectedAgentId: { [session.id]: agent.id },
    } as never);
    storySpies.runTurn.mockImplementation(assistantTurnStream('done scanning'));

    await useAppStore.getState().sendTurn({ sessionId: session.id, content: 'first look' });
    await useAppStore.getState().sendTurn({ sessionId: session.id, content: 'keep going' });

    expect(storySpies.prepareSessionContainer).toHaveBeenCalledTimes(1);
    expect(recordedEventKinds()).toEqual(['worktree_created']);
  });
});

describe('story: a session seeded from a GitHub issue', () => {
  it('records the external task as its only event and still owns no files', async () => {
    const { session } = await useAppStore.getState().createSession({
      workspaceId: WORKSPACE_ID,
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
    expect(recordedEventKinds()).toEqual(['external_task_created']);
    expect(recordedEvent('external_task_created')?.payload).toMatchObject({
      provider: 'github',
      identifier: '#123',
      title: 'Login redirect loops',
    });
    expect(
      useAppStore.getState().sessionExternalTasks[session.id]?.map((task) => task.identifier),
    ).toEqual(['#123']);

    expect(storySpies.prepareSessionContainer).not.toHaveBeenCalled();
    expect(storySpies.createWorktree).not.toHaveBeenCalled();
    expect(storySpies.insertSessionWorktree).not.toHaveBeenCalled();
    expect(useAppStore.getState().sessionWorktrees[session.id]).toEqual([]);
  });
});

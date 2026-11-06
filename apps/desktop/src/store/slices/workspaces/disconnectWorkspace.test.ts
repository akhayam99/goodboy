import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { disconnectWorkspaceAndProjects } from '@goodboy/db';
import type { ProviderRunId, TurnState } from '@goodboy/types';
import { aSession, aWorkflowRun, aWorkspace, anAgent, TEST_NOW } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../store/storyHarness';
import { disconnectWorkspace } from './disconnectWorkspace';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).dbLibModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../store/storyHarness')).dbModuleMock({
    disconnectWorkspaceAndProjects: vi.fn(async () => undefined),
  }),
);
vi.mock('../../../features/chat/turn', async () =>
  (await import('../../../store/storyHarness')).turnModuleMock(),
);
vi.mock('../../../features/permissions/permissions', async () =>
  (await import('../../../store/storyHarness')).permissionsModuleMock(),
);
vi.mock('../../../features/providers/providers', async () =>
  (await import('../../../store/storyHarness')).providersModuleMock(),
);
vi.mock('../../../features/providers/routing', async () =>
  (await import('../../../store/storyHarness')).routingModuleMock(),
);
vi.mock('../../../features/budget/budget', async () =>
  (await import('../../../store/storyHarness')).budgetModuleMock(),
);
vi.mock('../../../features/workflows/workflows', async () =>
  (await import('../../../store/storyHarness')).workflowsModuleMock(),
);
vi.mock('../../../features/worktree/worktree', async () =>
  (await import('../../../store/storyHarness')).worktreeModuleMock(),
);
vi.mock('../../../shared/lib/repo', async () =>
  (await import('../../../store/storyHarness')).repoModuleMock(),
);
vi.mock('../../../features/plans/plans', async () =>
  (await import('../../../store/storyHarness')).plansModuleMock(),
);

const workspace = aWorkspace();

describe('disconnectWorkspace stops all live work', () => {
  let useAppStore: StoryStore;

  beforeAll(async () => {
    useAppStore = await importStore();
  }, STORE_IMPORT_TIMEOUT_MS);

  beforeEach(async () => {
    await resetStoryStore();
    useAppStore.setState({
      workspaces: [workspace],
      currentWorkspaceId: workspace.id,
      stopWorkflowRunNow: vi.fn(async () => 'stopped' as const),
      emitNotification: vi.fn(async () => undefined),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const disconnect = () =>
    disconnectWorkspace(useAppStore.setState, useAppStore.getState)(workspace.id);

  it('stops a blocked turn as stopped by you and stops a deciding workflow run', async () => {
    storySpies.listLiveRunIds.mockResolvedValueOnce(new Set(['run-blocked']));
    const waiting = aSession({ workspaceId: workspace.id });
    const agent = anAgent({ sessionId: waiting.id });
    storySpies.invokeAgentUpdateStatus.mockResolvedValue({
      ...agent,
      status: 'stopped',
      stoppedBy: 'you',
    });
    const run = aWorkflowRun();
    const deciding = aSession({ workspaceId: workspace.id, workflowRuns: [run] });
    useAppStore.setState({
      sessions: [waiting, deciding],
      sessionPhaseRuns: { [waiting.id]: [agent] },
      agentTurnState: {
        [agent.id]: {
          kind: 'blocked',
          runId: 'run-blocked' as ProviderRunId,
          blockedAt: TEST_NOW,
        },
      },
      orchestratingWorkflowRuns: { [run.id]: true },
    });
    const { stopWorkflowRunNow } = useAppStore.getState();

    await disconnect();

    expect(storySpies.cancelTurn).toHaveBeenCalledWith('run-blocked');
    expect(storySpies.invokeAgentUpdateStatus).toHaveBeenCalledWith(
      agent.id,
      expect.objectContaining({ status: 'stopped', stoppedBy: 'you' }),
    );
    expect(stopWorkflowRunNow).toHaveBeenCalledWith(deciding.id, run.id);
  });

  describe('when an agent does not stop', () => {
    const live = aSession({ workspaceId: workspace.id });
    const agent = anAgent({ sessionId: live.id, status: 'running' });
    const running: TurnState = {
      kind: 'running',
      runId: 'run-stuck' as ProviderRunId,
      startedAt: TEST_NOW,
    };

    const seedLive = () => {
      useAppStore.setState({
        sessions: [live],
        sessionPhaseRuns: { [live.id]: [agent] },
        agentTurnState: { [agent.id]: running },
        cancelTurnConfirmed: vi.fn(async () => ({
          outcome: 'still_running' as const,
          exitedAt: null,
        })),
      });
    };

    it('keeps the workspace and its agent state, and tells why', async () => {
      seedLive();

      await expect(disconnect()).rejects.toThrow('An agent did not stop');

      const state = useAppStore.getState();
      expect(state.workspaces).toEqual([workspace]);
      expect(state.currentWorkspaceId).toBe(workspace.id);
      expect(state.agentTurnState[agent.id]).toEqual(running);
      expect(state.sessionPhaseRuns[live.id]).toEqual([agent]);
      expect(disconnectWorkspaceAndProjects).not.toHaveBeenCalled();
    });

    it('goes through on the next try once the agent stopped', async () => {
      seedLive();
      await expect(disconnect()).rejects.toThrow('An agent did not stop');
      useAppStore.setState({
        cancelTurnConfirmed: vi.fn(async () => ({
          outcome: 'exited' as const,
          exitedAt: TEST_NOW,
        })),
      });

      await disconnect();

      expect(disconnectWorkspaceAndProjects).toHaveBeenCalledOnce();
      expect(useAppStore.getState().workspaces).toEqual([]);
    });
  });

  it('leaves live work alone when the workspace is not the current one', async () => {
    const running = aSession({
      workspaceId: workspace.id,
      state: { kind: 'running', runId: 'run-live' as ProviderRunId, startedAt: TEST_NOW },
    });
    useAppStore.setState({ sessions: [running], currentWorkspaceId: null });

    await disconnect();

    expect(storySpies.cancelTurn).not.toHaveBeenCalled();
  });
});

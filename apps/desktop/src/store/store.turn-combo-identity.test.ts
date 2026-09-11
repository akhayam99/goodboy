import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AgentId,
  IsoDateTime,
  MountId,
  ProjectId,
  SessionId,
  SessionProjectMount,
  TurnProviderOverride,
  WorkspaceId,
} from '@goodboy/types';
import {
  buildStoryAgent,
  buildStorySession,
  buildStoryWorkspace,
  emptyTurnStream,
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
vi.mock('../shared/lib/repo', async () => (await import('./storyHarness')).repoModuleMock());
vi.mock('../features/plans/plans', async () => (await import('./storyHarness')).plansModuleMock());

const SESSION_ID = 'session-combo-1' as SessionId;
const AGENT_A = 'agent-combo-a' as AgentId;
const WORKSPACE_ID = 'workspace-combo' as WorkspaceId;
const NOW = '2026-07-30T00:00:00.000Z' as IsoDateTime;
const USAGE_LIMIT_MESSAGE = "You've hit your usage limit. Try again at 3:10 PM.";

const FAST_OVERRIDE: TurnProviderOverride = {
  providerId: 'cursor',
  model: 'composer-2.5',
  selection: { key: 'composer-2.5', toggles: { thinking: false, fast: true } },
  explicit: true,
};

const connectedCursorState = () => ({
  providers: [
    {
      id: 'cursor',
      binary: 'cursor-agent',
      connection: 'connected',
      name: 'Cursor',
      installation: 'installed',
    } as never,
  ],
  authResults: { cursor: { state: 'connected', identity: 'test' } } as never,
});

type StoreModule = typeof import('./store');
let useAppStore: StoreModule['useAppStore'];

beforeAll(async () => {
  ({ useAppStore } = await import('./store'));
}, 60_000);

const mockRouting = async (fallbackUsed: boolean) => {
  const routingMod = await import('../features/providers/routing');
  (routingMod.resolveProviderForTurn as ReturnType<typeof vi.fn>).mockResolvedValue({
    selectedProvider: 'cursor',
    selectedModel: 'composer-2.5',
    reason: 'preference',
    fallbackUsed,
  });
};

const COMBO_MOUNT: SessionProjectMount = {
  mountId: 'mount-combo' as MountId,
  sessionId: SESSION_ID,
  projectId: 'project-combo' as ProjectId,
  mountName: 'repo',
  worktreePath: '/tmp/wt',
  repoRoot: '/tmp/repo',
  branch: 'goodboy/combo',
  lastWorktreePath: null,
  baseBranch: null,
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 0,
};

describe('sendTurn keeps the executed combo across a retry', () => {
  beforeEach(async () => {
    resetStorySpies();
    storySpies.runTurn.mockImplementation(() => emptyTurnStream());
    storySpies.tauriInvoke.mockResolvedValue({
      stdout: JSON.stringify({ result: JSON.stringify({ upserts: [] }) }),
      stderr: '',
      exitCode: 0,
    } as never);
    await mockRouting(false);
  });

  afterEach(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  const setup = () => {
    useAppStore.setState({
      sessions: [
        buildStorySession({
          id: SESSION_ID,
          workspaceId: WORKSPACE_ID,
          goal: 'test combo identity',
          state: { kind: 'idle', lastActivityAt: NOW },
          providerPreference: { defaultProvider: 'cursor', allowTurnOverride: true },
        }),
      ],
      projects: [],
      sessionWorktrees: { [SESSION_ID]: ['/tmp/wt'] },
      sessionProjectMounts: {
        [SESSION_ID]: [COMBO_MOUNT],
      },
      sessionPhaseRuns: {
        [SESSION_ID]: [buildStoryAgent({ id: AGENT_A, sessionId: SESSION_ID, name: 'agent 0' })],
      },
      selectedAgentId: { [SESSION_ID]: AGENT_A },
      transcripts: { [AGENT_A]: [] },
      agentEffortOverride: {},
      agentProviderOverride: {},
      agentModelOverride: {},
      providerCooldowns: {},
      notifications: [],
      workspaces: [
        buildStoryWorkspace({ id: WORKSPACE_ID, name: 'ws', slug: 'ws', sessionsRoot: '/tmp' }),
      ],
      ...connectedCursorState(),
    });
  };

  const spawnedModels = (): ReadonlyArray<string | undefined> =>
    storySpies.runTurn.mock.calls.map((call) => call[0]?.model);

  it('repeats the fast combo when the provider is unreachable', async () => {
    setup();
    storySpies.runTurn.mockImplementationOnce(async function* () {
      throw new Error('connect ECONNREFUSED 127.0.0.1:443');
    });

    await useAppStore.getState().sendTurn({
      sessionId: SESSION_ID,
      agentId: AGENT_A,
      content: 'go',
      override: FAST_OVERRIDE,
    });

    expect(storySpies.runTurn).toHaveBeenCalledTimes(2);
    expect(spawnedModels()).toEqual(['composer-2.5-fast', 'composer-2.5-fast']);
  });

  it('repeats the fast combo when the usage limit retry fires', async () => {
    setup();
    const scheduled: Array<() => void> = [];
    const timerSpy = vi.spyOn(globalThis, 'setTimeout').mockImplementation(((
      handler: () => void,
    ) => {
      scheduled.push(handler);
      return 0;
    }) as never);
    storySpies.runTurn.mockImplementationOnce(async function* () {
      throw new Error(USAGE_LIMIT_MESSAGE);
    });

    await expect(
      useAppStore.getState().sendTurn({
        sessionId: SESSION_ID,
        agentId: AGENT_A,
        content: 'go',
        override: FAST_OVERRIDE,
      }),
    ).rejects.toThrow('usage limit');
    timerSpy.mockRestore();

    expect(scheduled).toHaveLength(1);
    scheduled[0]?.();
    await vi.waitFor(() => {
      expect(storySpies.runTurn).toHaveBeenCalledTimes(2);
    });
    expect(spawnedModels()[1]).toBe('composer-2.5-fast');
  });

  it('keeps the effort of the retried turn out of the model id', async () => {
    setup();
    storySpies.runTurn.mockImplementationOnce(async function* () {
      throw new Error('connect ECONNREFUSED 127.0.0.1:443');
    });

    await useAppStore.getState().sendTurn({
      sessionId: SESSION_ID,
      agentId: AGENT_A,
      content: 'go',
      override: {
        providerId: 'cursor',
        model: 'opus-5',
        selection: { key: 'opus-5', effort: 'high', toggles: { thinking: true, fast: false } },
        explicit: true,
      },
    });

    expect(spawnedModels()).toEqual(['claude-opus-5-thinking-high', 'claude-opus-5-thinking-high']);
  });
});

describe('sendTurn checks the model it ran against the model that was picked', () => {
  beforeEach(async () => {
    resetStorySpies();
    storySpies.runTurn.mockImplementation(() => emptyTurnStream());
    storySpies.tauriInvoke.mockResolvedValue({
      stdout: JSON.stringify({ result: JSON.stringify({ upserts: [] }) }),
      stderr: '',
      exitCode: 0,
    } as never);
    await mockRouting(false);
  });

  afterEach(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  const setup = () => {
    useAppStore.setState({
      sessions: [
        buildStorySession({
          id: SESSION_ID,
          workspaceId: WORKSPACE_ID,
          goal: 'test combo identity',
          state: { kind: 'idle', lastActivityAt: NOW },
          providerPreference: { defaultProvider: 'cursor', allowTurnOverride: true },
        }),
      ],
      projects: [],
      sessionWorktrees: { [SESSION_ID]: ['/tmp/wt'] },
      sessionProjectMounts: {
        [SESSION_ID]: [COMBO_MOUNT],
      },
      sessionPhaseRuns: {
        [SESSION_ID]: [buildStoryAgent({ id: AGENT_A, sessionId: SESSION_ID, name: 'agent 0' })],
      },
      selectedAgentId: { [SESSION_ID]: AGENT_A },
      transcripts: { [AGENT_A]: [] },
      agentEffortOverride: {},
      agentProviderOverride: {},
      agentModelOverride: {},
      providerCooldowns: {},
      notifications: [],
      workspaces: [
        buildStoryWorkspace({ id: WORKSPACE_ID, name: 'ws', slug: 'ws', sessionsRoot: '/tmp' }),
      ],
      ...connectedCursorState(),
    });
  };

  const mismatchWarning = () =>
    useAppStore
      .getState()
      .notifications.find(
        (entry) => entry.title === 'the turn did not run on the model you picked',
      );

  it('stays quiet when the pick names the combo by its slug', async () => {
    setup();

    await useAppStore.getState().sendTurn({
      sessionId: SESSION_ID,
      agentId: AGENT_A,
      content: 'go',
      override: {
        providerId: 'cursor',
        model: 'composer-2.5-fast',
        selection: { key: 'composer-2.5', toggles: { thinking: false, fast: true } },
        explicit: true,
      },
    });

    expect(storySpies.runTurn.mock.calls[0]?.[0]?.model).toBe('composer-2.5-fast');
    expect(mismatchWarning()).toBeUndefined();
  });

  it('stays quiet when the pick names the model by its key', async () => {
    setup();

    await useAppStore.getState().sendTurn({
      sessionId: SESSION_ID,
      agentId: AGENT_A,
      content: 'go',
      override: FAST_OVERRIDE,
    });

    expect(mismatchWarning()).toBeUndefined();
  });

  it('speaks up when the picked model is one no provider offers', async () => {
    setup();

    await useAppStore.getState().sendTurn({
      sessionId: SESSION_ID,
      agentId: AGENT_A,
      content: 'go',
      override: { providerId: 'cursor', model: 'not-a-model', explicit: true },
    });

    expect(storySpies.runTurn.mock.calls[0]?.[0]?.model).toBe('composer-2.5');
    expect(mismatchWarning()?.body).toContain('not-a-model');
  });

  it('speaks up when the picked selection names a key no provider offers', async () => {
    setup();

    await useAppStore.getState().sendTurn({
      sessionId: SESSION_ID,
      agentId: AGENT_A,
      content: 'go',
      override: {
        providerId: 'cursor',
        model: 'not-a-model',
        selection: { key: 'not-a-model' },
        explicit: true,
      },
    });

    expect(mismatchWarning()?.body).toContain('not-a-model');
  });

  it('speaks up when the base model runs instead of the fast combo that was picked', async () => {
    setup();
    await mockRouting(true);

    await useAppStore.getState().sendTurn({
      sessionId: SESSION_ID,
      agentId: AGENT_A,
      content: 'go',
      override: FAST_OVERRIDE,
    });

    expect(storySpies.runTurn.mock.calls[0]?.[0]?.model).toBe('composer-2.5');
    expect(mismatchWarning()?.body).toContain('composer-2.5-fast');
  });
});

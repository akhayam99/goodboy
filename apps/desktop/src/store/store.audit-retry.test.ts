import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStorySpies,
  storySpies,
  type StoryStore,
} from './storyHarness';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  MountId,
  ProjectId,
  Session,
  SessionId,
  TurnEvent,
  WorkspaceId,
} from '@goodboy/types';

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

const runTurnSpy = storySpies.runTurn;
const permissionAuditInsertSpy = storySpies.invokePermissionAuditInsert;
const auditRetryEnqueueSpy = storySpies.invokeAuditRetryEnqueue;
const auditRetryDrainSpy = storySpies.invokeAuditRetryDrain;
const auditRetryUpdateSpy = storySpies.invokeAuditRetryUpdate;
const auditRetryDeleteSpy = storySpies.invokeAuditRetryDelete;

const SESSION_ID = 'session-1' as SessionId;
const WORKSPACE_ID = 'workspace-1' as WorkspaceId;
const NOW: IsoDateTime = '2026-05-07T00:00:00.000Z' as IsoDateTime;

function buildSession(): Session {
  return {
    id: SESSION_ID,
    workspaceId: WORKSPACE_ID,
    goal: 'test',
    state: { kind: 'idle', lastActivityAt: NOW },
    contextSlots: [],
    providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: false },
    permissionMode: 'bypassPermissions' as const,
    autoRun: false,
    titleUserEdited: false,
    workflowRuns: [],
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function makeRetryEntry(overrides: { id?: string; payloadJson?: string; attempts?: number }) {
  return {
    id: overrides.id ?? 'retry-1',
    payloadJson:
      overrides.payloadJson ??
      JSON.stringify({
        id: 'req-1',
        runId: 'run-1',
        sessionId: SESSION_ID,
        toolUseId: 'tu-1',
        toolName: 'Edit',
        inputJson: '{}',
        decision: 'allow',
        decidedBy: 'rule',
        requestedAt: NOW,
        decidedAt: NOW,
      }),
    attempts: overrides.attempts ?? 0,
    lastError: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

async function* emptyStream(): AsyncIterable<TurnEvent> {}

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

describe('audit retry queue, sendTurn enqueue on failure', () => {
  beforeEach(() => {
    resetStorySpies();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function setupSession(useAppStore: Awaited<ReturnType<typeof importStore>>) {
    const defaultAgent: Agent = {
      id: 'agent-1' as AgentId,
      sessionId: SESSION_ID,
      ordinal: 0,
      name: 'agent 1',
      status: 'pending',
    };
    useAppStore.setState({
      sessions: [buildSession()],
      sessionWorktrees: { [SESSION_ID]: ['/tmp/wt'] },
      sessionProjectMounts: {
        [SESSION_ID]: [
          {
            projectId: 'project-turn' as ProjectId,
            mountName: 'repo',
            worktreePath: '/tmp/wt',
            repoRoot: '/tmp/repo',
            branch: 'goodboy/turn',
            mountId: 'mount-fixture-1' as MountId,
            sessionId: SESSION_ID,
            lastWorktreePath: null,
            baseBranch: null,
            parallelIndex: 0,
            isAttached: true,
            diskState: 'present',
            revision: 0,
          },
        ],
      },
      sessionPhaseRuns: { [SESSION_ID]: [defaultAgent] },
      selectedAgentId: { [SESSION_ID]: defaultAgent.id },
      providers: [
        {
          id: 'anthropic',
          binary: 'claude',
          connection: 'connected',
          name: 'Claude',
          installation: 'installed',
        } as never,
      ],
      authResults: {
        anthropic: { state: 'connected', identity: 'test' },
        cursor: { state: 'connected', identity: 'test' },
        codex: { state: 'connected', identity: 'test' },
      } as never,
      workspaces: [
        {
          id: WORKSPACE_ID,
          name: 'ws',
          slug: 'ws',
          overrides: {
            defaultProviderId: null,
            defaultBranchPrefix: null,
            defaultVerbosity: null,
            providerBindings: null,
            taskModels: null,
            roleModels: null,
            parallelAgents: null,
            providerPool: null,
            attributionFooter: null,
            replyVoice: null,
            replyStyleNote: null,
            replyTemplateFixed: null,
            replyTemplateNoChange: null,
            resolveOnGithub: null,
            resolveCommitStyle: null,
            afterMerge: null,
            defaultBranchTemplate: null,
          },
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
    });
  }

  it('enqueues an explicit user decision when audit insert fails', async () => {
    permissionAuditInsertSpy.mockRejectedValue(new Error('db locked'));

    async function* toolStream(): AsyncIterable<TurnEvent> {
      yield {
        kind: 'tool_call_start',
        toolUseId: 'tu-1',
        toolName: 'Edit',
        input: { path: '/tmp/x' },
        at: NOW,
      } as TurnEvent;
    }
    runTurnSpy.mockImplementation(() => toolStream());
    setupSession(useAppStore);
    useAppStore.setState({ volatilePermissionAllows: new Set(['tu-1']) });
    await useAppStore.getState().sendTurn({ sessionId: SESSION_ID, content: 'go' });

    expect(permissionAuditInsertSpy).toHaveBeenCalledTimes(1);
    expect(auditRetryEnqueueSpy).toHaveBeenCalledTimes(1);
    const [enqueuedId, enqueuedPayload] = auditRetryEnqueueSpy.mock.calls[0] as [string, string];
    expect(typeof enqueuedId).toBe('string');
    const parsed = JSON.parse(enqueuedPayload) as Record<string, unknown>;
    expect(parsed.toolName).toBe('Edit');
    expect(typeof parsed.decision).toBe('string');
  });

  it('does not write or enqueue a default decision', async () => {
    permissionAuditInsertSpy.mockResolvedValue({});

    async function* toolStream(): AsyncIterable<TurnEvent> {
      yield {
        kind: 'tool_call_start',
        toolUseId: 'tu-2',
        toolName: 'Read',
        input: {},
        at: NOW,
      } as TurnEvent;
    }
    runTurnSpy.mockImplementation(() => toolStream());
    setupSession(useAppStore);
    await useAppStore.getState().sendTurn({ sessionId: SESSION_ID, content: 'go' });

    expect(permissionAuditInsertSpy).not.toHaveBeenCalled();
    expect(auditRetryEnqueueSpy).not.toHaveBeenCalled();
  });
});

describe('audit retry queue, drain worker (happy path)', () => {
  beforeEach(() => {
    resetStorySpies();
    runTurnSpy.mockImplementation(() => emptyStream());
  });

  afterEach(() => {
    vi.clearAllMocks();
    auditRetryDrainSpy.mockReset();
    auditRetryDeleteSpy.mockReset();
    auditRetryUpdateSpy.mockReset();
    permissionAuditInsertSpy.mockReset();
  });

  async function runHydrate() {
    const { runDbMigrations } = await import('../shared/lib/dbBoot');
    (runDbMigrations as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const { getSetting } = await import('@goodboy/db');
    (getSetting as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const { checkProviderAuth } = await import('../features/providers/providers');
    (checkProviderAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
      state: 'connected',
      identity: 'test',
    });
    await useAppStore.getState().hydrate();
    await Promise.resolve();
  }

  it('drain happy path: retries insert, deletes on success', async () => {
    const entry = { ...makeRetryEntry({ id: 'retry-happy', attempts: 2 }), updatedAt: 0 };
    auditRetryDrainSpy.mockResolvedValue([entry]);
    permissionAuditInsertSpy.mockResolvedValue({});

    await runHydrate();

    expect(auditRetryDrainSpy).toHaveBeenCalledWith(50);
    expect(permissionAuditInsertSpy).toHaveBeenCalledTimes(1);
    expect(auditRetryDeleteSpy).toHaveBeenCalledWith('retry-happy');
    expect(auditRetryUpdateSpy).not.toHaveBeenCalled();
  });

  it('drain failure path: increments attempts when insert still fails', async () => {
    const entry = { ...makeRetryEntry({ id: 'retry-fail', attempts: 3 }), updatedAt: 0 };
    auditRetryDrainSpy.mockResolvedValue([entry]);
    permissionAuditInsertSpy.mockRejectedValue(new Error('still locked'));

    await runHydrate();

    expect(auditRetryUpdateSpy).toHaveBeenCalledWith('retry-fail', 4, 'still locked');
    expect(auditRetryDeleteSpy).not.toHaveBeenCalled();
  });

  it('max-attempts boundary: deletes entry at attempt 5', async () => {
    const entry = { ...makeRetryEntry({ id: 'retry-max', attempts: 4 }), updatedAt: 0 };
    auditRetryDrainSpy.mockResolvedValue([entry]);
    permissionAuditInsertSpy.mockRejectedValue(new Error('permanent failure'));

    await runHydrate();

    expect(auditRetryDeleteSpy).toHaveBeenCalledWith('retry-max');
    expect(auditRetryUpdateSpy).not.toHaveBeenCalled();
  });

  it('max-attempts exhausted: emits an error notification', async () => {
    const entry = { ...makeRetryEntry({ id: 'retry-exhausted', attempts: 4 }), updatedAt: 0 };
    auditRetryDrainSpy.mockResolvedValue([entry]);
    permissionAuditInsertSpy.mockRejectedValue(new Error('permanent failure'));
    await runHydrate();

    await vi.waitFor(() => {
      expect(useAppStore.getState().notifications).toEqual([
        expect.objectContaining({
          kind: 'error',
          severity: 'error',
          coalesceKey: 'audit-retry:exhausted',
        }),
      ]);
    });
    expect(auditRetryDeleteSpy).toHaveBeenCalledWith('retry-exhausted');
  });

  it('drain skips rows with invalid JSON payload (deletes them)', async () => {
    const entry = {
      ...makeRetryEntry({ id: 'retry-bad-json', payloadJson: 'not-json' }),
      updatedAt: 0,
    };
    auditRetryDrainSpy.mockResolvedValue([entry]);

    await runHydrate();

    expect(auditRetryDeleteSpy).toHaveBeenCalledWith('retry-bad-json');
    expect(permissionAuditInsertSpy).not.toHaveBeenCalled();
  });

  it('drain deletes legacy default decisions without inserting them', async () => {
    const entry = {
      ...makeRetryEntry({
        id: 'retry-default',
        payloadJson: JSON.stringify({
          id: 'req-default',
          runId: 'run-1',
          sessionId: SESSION_ID,
          toolUseId: 'tu-default',
          toolName: 'Read',
          inputJson: '{}',
          decision: 'deny',
          decidedBy: 'default',
          requestedAt: NOW,
          decidedAt: NOW,
        }),
      }),
      updatedAt: 0,
    };
    auditRetryDrainSpy.mockResolvedValue([entry]);

    await runHydrate();

    expect(auditRetryDeleteSpy).toHaveBeenCalledWith('retry-default');
    expect(permissionAuditInsertSpy).not.toHaveBeenCalled();
  });

  it('corrupt payload: emits a warning notification and deletes the entry', async () => {
    const entry = {
      ...makeRetryEntry({ id: 'retry-bad-json', payloadJson: 'not-json' }),
      updatedAt: 0,
    };
    auditRetryDrainSpy.mockResolvedValue([entry]);
    await runHydrate();

    await vi.waitFor(() => {
      expect(useAppStore.getState().notifications).toEqual([
        expect.objectContaining({
          kind: 'error',
          severity: 'warning',
          coalesceKey: 'audit-retry:corrupt',
        }),
      ]);
    });
    expect(auditRetryDeleteSpy).toHaveBeenCalledWith('retry-bad-json');
  });

  it('backoff: skips entry whose updatedAt is too recent for attempt count', async () => {
    const entry = {
      ...makeRetryEntry({ id: 'retry-backoff', attempts: 0 }),
      updatedAt: Date.now(),
    };
    auditRetryDrainSpy.mockResolvedValue([entry]);
    permissionAuditInsertSpy.mockResolvedValue({});

    await runHydrate();

    expect(permissionAuditInsertSpy).not.toHaveBeenCalled();
    expect(auditRetryDeleteSpy).not.toHaveBeenCalled();
  });

  it('backoff: processes entry whose updatedAt is old enough', async () => {
    const entry = { ...makeRetryEntry({ id: 'retry-old', attempts: 0 }), updatedAt: 0 };
    auditRetryDrainSpy.mockResolvedValue([entry]);
    permissionAuditInsertSpy.mockResolvedValue({});

    await runHydrate();

    expect(permissionAuditInsertSpy).toHaveBeenCalledTimes(1);
    expect(auditRetryDeleteSpy).toHaveBeenCalledWith('retry-old');
  });
});

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../store/storyHarness';
import type {
  AgentId,
  IsoDateTime,
  PermissionRuleId,
  ProviderRunId,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../shared/lib/db', async () =>
  (await import('../../store/storyHarness')).dbLibModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../store/storyHarness')).dbModuleMock());
vi.mock('../../features/chat/turn', async () =>
  (await import('../../store/storyHarness')).turnModuleMock(),
);
vi.mock('../../features/permissions/permissions', async () =>
  (await import('../../store/storyHarness')).permissionsModuleMock(),
);
vi.mock('../../features/providers/providers', async () =>
  (await import('../../store/storyHarness')).providersModuleMock(),
);
vi.mock('../../features/providers/routing', async () =>
  (await import('../../store/storyHarness')).routingModuleMock(),
);
vi.mock('../../features/budget/budget', async () =>
  (await import('../../store/storyHarness')).budgetModuleMock(),
);
vi.mock('../../features/skills/skills', async () =>
  (await import('../../store/storyHarness')).skillsModuleMock(),
);
vi.mock('../../features/workflows/workflows', async () =>
  (await import('../../store/storyHarness')).workflowsModuleMock(),
);
vi.mock('../../features/worktree/worktree', async () =>
  (await import('../../store/storyHarness')).worktreeModuleMock(),
);
vi.mock('../../shared/lib/repo', async () =>
  (await import('../../store/storyHarness')).repoModuleMock(),
);
vi.mock('../../features/plans/plans', async () =>
  (await import('../../store/storyHarness')).plansModuleMock(),
);

const permissionRuleUpsertSpy = storySpies.invokePermissionRuleUpsert;

const SESSION_ID = 'sess-1' as SessionId;
const WORKSPACE_ID = 'ws-1' as WorkspaceId;
const AGENT_ID = 'agent-1' as AgentId;
const RUN_ID = 'run-1' as ProviderRunId;
const AT: IsoDateTime = '2026-05-07T00:00:00.000Z' as IsoDateTime;
const TOOL_USE_ID = 'tu-abc';
const TOOL_NAME = 'Bash';

function buildSession() {
  return {
    id: SESSION_ID,
    workspaceId: WORKSPACE_ID,
    goal: 'test',
    state: { kind: 'idle' as const, lastActivityAt: AT },
    contextSlots: [],
    providerPreference: { defaultProvider: 'anthropic' as const, allowTurnOverride: false },
    permissionMode: 'bypassPermissions' as const,
    autoRun: false,
    titleUserEdited: false,
    workflowRuns: [],
    createdAt: AT,
    updatedAt: AT,
  };
}

describe('resolvePermissionRequest', () => {
  let useAppStore: StoryStore;

  beforeAll(async () => {
    useAppStore = await importStore();
  }, STORE_IMPORT_TIMEOUT_MS);

  beforeEach(async () => {
    await resetStoryStore();
    permissionRuleUpsertSpy.mockResolvedValue({
      id: 'rule-new' as PermissionRuleId,
      scope: 'session',
      pattern: { tool: TOOL_NAME },
      decision: 'allow',
      priority: 100,
      createdAt: AT,
      updatedAt: AT,
    });
    useAppStore.setState({ sessions: [buildSession()] });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const call = (
    store: ReturnType<typeof useAppStore.getState>,
    scope: 'global' | 'workspace' | 'session' | 'once' | 'deny',
  ) =>
    store.resolvePermissionRequest({
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      toolUseId: TOOL_USE_ID,
      toolName: TOOL_NAME,
      runId: RUN_ID,
      scope,
    });

  it('approve global, upserts rule with scope global, decision allow', async () => {
    await call(useAppStore.getState(), 'global');
    expect(permissionRuleUpsertSpy).toHaveBeenCalledOnce();
    const arg = (permissionRuleUpsertSpy.mock.calls as unknown as [unknown[]])[0]![0] as Record<
      string,
      unknown
    >;
    expect(arg.scope).toBe('global');
    expect(arg.decision).toBe('allow');
    expect(arg.patternTool).toBe(TOOL_NAME);
    expect(arg.workspaceId).toBeUndefined();
    expect(arg.sessionId).toBeUndefined();
  });

  it('approve workspace, upserts rule with scope workspace + workspaceId', async () => {
    await call(useAppStore.getState(), 'workspace');
    expect(permissionRuleUpsertSpy).toHaveBeenCalledOnce();
    const arg = (permissionRuleUpsertSpy.mock.calls as unknown as [unknown[]])[0]![0] as Record<
      string,
      unknown
    >;
    expect(arg.scope).toBe('workspace');
    expect(arg.decision).toBe('allow');
    expect(arg.workspaceId).toBe(WORKSPACE_ID);
    expect(arg.sessionId).toBeUndefined();
  });

  it('approve session, upserts rule with scope task + sessionId', async () => {
    await call(useAppStore.getState(), 'session');
    expect(permissionRuleUpsertSpy).toHaveBeenCalledOnce();
    const arg = (permissionRuleUpsertSpy.mock.calls as unknown as [unknown[]])[0]![0] as Record<
      string,
      unknown
    >;
    expect(arg.scope).toBe('session');
    expect(arg.decision).toBe('allow');
    expect(arg.sessionId).toBe(SESSION_ID);
    expect(arg.workspaceId).toBeUndefined();
  });

  it('approve once, does NOT call upsert, adds toolUseId to volatilePermissionAllows', async () => {
    await call(useAppStore.getState(), 'once');
    expect(permissionRuleUpsertSpy).not.toHaveBeenCalled();
    const volatile = useAppStore.getState().volatilePermissionAllows;
    expect(volatile.has(TOOL_USE_ID)).toBe(true);
  });

  it('deny, upserts deny rule with scope task + sessionId', async () => {
    await call(useAppStore.getState(), 'deny');
    expect(permissionRuleUpsertSpy).toHaveBeenCalledOnce();
    const arg = (permissionRuleUpsertSpy.mock.calls as unknown as [unknown[]])[0]![0] as Record<
      string,
      unknown
    >;
    expect(arg.scope).toBe('session');
    expect(arg.decision).toBe('deny');
    expect(arg.sessionId).toBe(SESSION_ID);
  });

  it('each scope appends a permission_decision TurnEvent', async () => {
    for (const scope of ['global', 'workspace', 'session', 'once', 'deny'] as const) {
      await resetStoryStore();
      permissionRuleUpsertSpy.mockResolvedValue({
        id: 'rule-new' as PermissionRuleId,
        scope: 'session',
        pattern: { tool: TOOL_NAME },
        decision: 'allow',
        priority: 100,
        createdAt: AT,
        updatedAt: AT,
      });
      useAppStore.setState({ sessions: [buildSession()] });

      await call(useAppStore.getState(), scope);
      const events = useAppStore.getState().transcripts[AGENT_ID] ?? [];
      const decEv = events.find((e) => e.kind === 'permission_decision');
      expect(decEv, `scope ${scope} missing permission_decision event`).toBeDefined();
      if (!decEv || decEv.kind !== 'permission_decision') {
        continue;
      }
      expect(decEv.decidedBy).toBe('user');
      expect(decEv.decision).toBe(scope === 'deny' ? 'deny' : 'allow');
      expect(decEv.scope).toBe(scope);
    }
  });
});

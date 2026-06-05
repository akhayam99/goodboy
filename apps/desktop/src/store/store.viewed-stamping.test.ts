import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Agent, AgentId, IsoDateTime, Session, SessionId, WorkspaceId } from '@goodboy/types';
import { agentHasUnread } from './selectors';

const markViewedSpy = vi.fn();

vi.mock('../features/chat/turn', () => ({
  runTurn: vi.fn(),
  cancelTurn: vi.fn(),
  encodeAuthRequiredMessage: () => '',
  isAuthErrorMessage: () => false,
}));

vi.mock('../features/permissions/permissions', () => ({
  invokePermissionRuleList: vi.fn(async () => []),
  invokePermissionAuditInsert: vi.fn(),
  invokeAuditRetryEnqueue: vi.fn(async () => undefined),
  invokeAuditRetryDrain: vi.fn(async () => []),
  invokeAuditRetryUpdate: vi.fn(async () => undefined),
  invokeAuditRetryDelete: vi.fn(async () => undefined),
  useEffectivePermissionRules: () => [],
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
}));

vi.mock('../shared/lib/db', () => ({
  runDbMigrations: vi.fn(),
  tauriDatabase: { execute: vi.fn(), select: vi.fn() },
}));

vi.mock('@goodboy/db', () => ({
  getSetting: vi.fn(),
  insertMessage: vi.fn(),
  insertProviderRun: vi.fn(),
  insertSession: vi.fn(),
  insertSessionWorktree: vi.fn(),
  insertTelemetry: vi.fn(),
  insertWorkspace: vi.fn(),
  listContextSlotsForSession: vi.fn(async () => []),
  listMessagesForSession: vi.fn(async () => []),
  listSessionsForWorkspace: vi.fn(async () => []),
  listTelemetryForSession: vi.fn(async () => []),
  listWorkspaces: vi.fn(async () => []),
  listWorktreesForTask: vi.fn(async () => []),
  setSetting: vi.fn(),
  summarizeSessionTelemetry: vi.fn(async () => null),
  summarizeWorkspaceTelemetry: vi.fn(async () => null),
  summarizeWorkspaceProviderTelemetry: vi.fn(async () => []),
  updateProviderRunStatus: vi.fn(),
  updateSessionState: vi.fn(),
  upsertContextSlot: vi.fn(),
  insertOpenQuestion: vi.fn(async () => undefined),
  markOpenQuestionsResolvedByText: vi.fn(async () => 0),
  insertTurnEvent: vi.fn(async () => undefined),
  insertTurnEventsBatch: vi.fn(async () => undefined),
  listWorktreesForSessions: vi.fn(async () => new Map()),
  listAgentsForSessions: vi.fn(async () => new Map()),
  listTurnEventsForAgent: vi.fn(async () => []),
  listTurnEventsForTask: vi.fn(async () => []),
  listMessagesForAgent: vi.fn(async () => []),
  insertNotification: vi.fn(async () => undefined),
  listNotifications: vi.fn(async () => []),
  markAllNotificationsRead: vi.fn(async () => undefined),
  clearAllNotifications: vi.fn(async () => undefined),
}));

vi.mock('../features/providers/providers', () => ({
  buildProviderList: () => [{ id: 'anthropic', binary: 'claude', connection: 'connected' }],
  checkProviderAuth: vi.fn(),
  getCursorStatus: vi.fn(),
  getCodexStatus: vi.fn(),
  getProviderStatus: vi.fn(),
}));

vi.mock('../features/providers/routing', () => ({
  resolveProviderForTurn: vi.fn(),
}));

vi.mock('../features/budget/budget', () => ({
  invokeBudgetRuleList: vi.fn(async () => []),
  invokeBudgetRuleUpsert: vi.fn(),
  invokeBudgetRuleDelete: vi.fn(),
  invokeBudgetAlertsList: vi.fn(async () => []),
  invokeBudgetAlertDismiss: vi.fn(),
  invokeSessionBudgetGet: vi.fn(),
  invokeSessionBudgetSet: vi.fn(),
  invokeCheckProviderBudget: vi.fn(),
}));

vi.mock('../features/skills/skills', () => ({
  invokeSkillList: vi.fn(async () => []),
  invokeSkillUpsert: vi.fn(),
  invokeSkillDelete: vi.fn(),
  invokeSkillRescan: vi.fn(),
  resolveSkillInvocation: vi.fn(),
}));

vi.mock('../features/workflows/workflows', () => ({
  invokeWorkflowList: vi.fn(async () => []),
  invokeWorkflowUpsert: vi.fn(),
  invokeWorkflowDelete: vi.fn(),
  invokeAgentList: vi.fn(async () => []),
  invokeAgentInsert: vi.fn(),
  invokeAgentUpdateStatus: vi.fn(),
  invokeAgentMarkViewed: (...args: unknown[]) => Promise.resolve(markViewedSpy(...args)),
  invokeWorkspacesWithUnread: vi.fn(async () => []),
}));

vi.mock('../features/worktree/worktree', () => ({
  createWorktree: vi.fn(),
  removeWorktree: vi.fn(),
}));

vi.mock('../shared/lib/repo', () => ({
  validateGitRepo: vi.fn(),
}));

vi.mock('../features/providers/provider-pricing', () => ({
  parseProviderPricingConfig: vi.fn(() => null),
  getCodexPriceOverride: vi.fn(() => null),
  refreshPricingTable: vi.fn(() => Promise.resolve()),
}));

const SESSION_ID = 'session-vs-1' as SessionId;
const AGENT_ID = 'agent-vs-1' as AgentId;
const WORKSPACE_ID = 'workspace-vs-1' as WorkspaceId;
const T1 = '2026-05-01T10:00:00.000Z' as IsoDateTime;
const T2 = '2026-05-01T11:00:00.000Z' as IsoDateTime;
const T3 = '2026-05-01T12:00:00.000Z' as IsoDateTime;

function buildSession(): Session {
  return {
    id: SESSION_ID,
    workspaceId: WORKSPACE_ID,
    goal: 'viewed stamping test',
    state: { kind: 'idle', lastActivityAt: T1 },
    contextSlots: [],
    providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: false },
    permissionMode: 'bypassPermissions',
    workflowRuns: [],
    autoRun: false,
    titleUserEdited: false,
    userStatus: 'wip',
    createdAt: T1,
    updatedAt: T1,
  };
}

function buildAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: AGENT_ID,
    sessionId: SESSION_ID,
    ordinal: 1,
    name: 'Agent 1',
    status: 'completed',
    ...overrides,
  };
}

async function importStore() {
  const mod = await import('./store');
  return mod.useAppStore;
}

describe('markAgentViewed', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('stamps lastViewedAt when agent has lastFinishedAt and no lastViewedAt', async () => {
    const useAppStore = await importStore();
    const agent = buildAgent({ lastFinishedAt: T2 });
    useAppStore.setState({
      sessions: [buildSession()],
      sessionPhaseRuns: { [SESSION_ID]: [agent] },
    });

    await useAppStore.getState().markAgentViewed(SESSION_ID, AGENT_ID);

    const runs = useAppStore.getState().sessionPhaseRuns[SESSION_ID] ?? [];
    const updated = runs.find((r) => r.id === AGENT_ID);
    expect(updated?.lastViewedAt).toBeDefined();
    expect(updated?.lastViewedAt! >= T2).toBe(true);
    expect(markViewedSpy).toHaveBeenCalledOnce();
  });

  it('stamps lastViewedAt when lastFinishedAt > lastViewedAt (stale viewed)', async () => {
    const useAppStore = await importStore();
    const agent = buildAgent({ lastFinishedAt: T3, lastViewedAt: T2 });
    useAppStore.setState({
      sessions: [buildSession()],
      sessionPhaseRuns: { [SESSION_ID]: [agent] },
    });

    await useAppStore.getState().markAgentViewed(SESSION_ID, AGENT_ID);

    const runs = useAppStore.getState().sessionPhaseRuns[SESSION_ID] ?? [];
    const updated = runs.find((r) => r.id === AGENT_ID);
    expect(updated?.lastViewedAt! >= T3).toBe(true);
    expect(markViewedSpy).toHaveBeenCalledOnce();
  });

  it('is a no-op when lastViewedAt >= lastFinishedAt', async () => {
    const useAppStore = await importStore();
    const agent = buildAgent({ lastFinishedAt: T2, lastViewedAt: T3 });
    useAppStore.setState({
      sessions: [buildSession()],
      sessionPhaseRuns: { [SESSION_ID]: [agent] },
    });

    await useAppStore.getState().markAgentViewed(SESSION_ID, AGENT_ID);

    const runs = useAppStore.getState().sessionPhaseRuns[SESSION_ID] ?? [];
    const updated = runs.find((r) => r.id === AGENT_ID);
    expect(updated?.lastViewedAt).toBe(T3);
    expect(markViewedSpy).not.toHaveBeenCalled();
  });

  it('is a no-op when agent has no lastFinishedAt (not yet terminal)', async () => {
    const useAppStore = await importStore();
    const agent = buildAgent({ status: 'running' });
    useAppStore.setState({
      sessions: [buildSession()],
      sessionPhaseRuns: { [SESSION_ID]: [agent] },
    });

    await useAppStore.getState().markAgentViewed(SESSION_ID, AGENT_ID);

    const runs = useAppStore.getState().sessionPhaseRuns[SESSION_ID] ?? [];
    const updated = runs.find((r) => r.id === AGENT_ID);
    expect(updated?.lastViewedAt).toBeUndefined();
    expect(markViewedSpy).not.toHaveBeenCalled();
  });
});

describe('agentHasUnread, after markAgentViewed', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns false after markAgentViewed stamps lastViewedAt', async () => {
    const useAppStore = await importStore();
    const agent = buildAgent({ lastFinishedAt: T2 });
    useAppStore.setState({
      sessions: [buildSession()],
      sessionPhaseRuns: { [SESSION_ID]: [agent] },
    });

    await useAppStore.getState().markAgentViewed(SESSION_ID, AGENT_ID);

    const runs = useAppStore.getState().sessionPhaseRuns[SESSION_ID] ?? [];
    const updated = runs.find((r) => r.id === AGENT_ID)!;
    expect(agentHasUnread(updated, false)).toBe(false);
  });

  it('returns true for a different session agent not yet marked viewed', async () => {
    const OTHER_SESSION = 'session-other' as SessionId;
    const OTHER_AGENT = 'agent-other' as AgentId;
    const useAppStore = await importStore();

    const currentAgent = buildAgent({ lastFinishedAt: T2 });
    const otherAgent = buildAgent({
      id: OTHER_AGENT,
      sessionId: OTHER_SESSION,
      lastFinishedAt: T3,
    });

    useAppStore.setState({
      sessions: [buildSession()],
      sessionPhaseRuns: {
        [SESSION_ID]: [currentAgent],
        [OTHER_SESSION]: [otherAgent],
      },
    });

    await useAppStore.getState().markAgentViewed(SESSION_ID, AGENT_ID);

    const otherRuns = useAppStore.getState().sessionPhaseRuns[OTHER_SESSION] ?? [];
    const otherUpdated = otherRuns.find((r) => r.id === OTHER_AGENT)!;
    expect(agentHasUnread(otherUpdated, false)).toBe(true);
  });
});

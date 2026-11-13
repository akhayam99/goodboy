import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { insertAgent, insertSession, insertWorkspace, setSetting } from '@goodboy/db';
import {
  brandId,
  type Agent,
  type AgentId,
  type IsoDateTime,
  type SessionId,
  type WorkspaceId,
} from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  buildStorySession,
  buildStoryWorkspace,
  importStore,
  openStorySqlite,
  resetStoryStore,
  storySqlite,
  stubStoryInvoke,
  type StoryStore,
} from './storyHarness';
import {
  SETTING_LAST_SESSION_ID,
  SETTING_LAST_WORKSPACE_ID,
  SETTING_REOPEN_LAST,
} from '../features/settings/settings';
import { unreadLabelOf } from '../features/session/unreadLabelOf';
import { BOOT_BUDGETS } from './slices/boot/bootBudgets';
import { unreadAgentsOf } from './slices/agents/unreadAgentsOf';
import { sessionHasUnread } from './slices/session-view/sessionHasUnread';
import { stageInfoOf } from './slices/session-view/stageInfoOf';
import type { AppState } from './types';

vi.mock('@tauri-apps/api/core', async () => (await import('./storyHarness')).tauriCoreModuleMock());
vi.mock('@tauri-apps/api/event', async () =>
  (await import('./storyHarness')).tauriEventModuleMock(),
);
vi.mock('../shared/lib/db', async () => (await import('./storyHarness')).sqliteDbLibModuleMock());
vi.mock('../shared/lib/dbBoot', async () => (await import('./storyHarness')).dbBootModuleMock());
vi.mock('../features/onboarding/onboardingSettings', async () =>
  (await import('./storyHarness')).onboardingStoreModuleMock(),
);
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
vi.mock('../features/workflows/workflows', async () =>
  (await import('./storyHarness')).workflowsModuleMock(),
);
vi.mock('../features/worktree/worktree', async () =>
  (await import('./storyHarness')).worktreeModuleMock(),
);
vi.mock('../shared/lib/repo', async () => (await import('./storyHarness')).repoModuleMock());
vi.mock('../features/plans/plans', async () => (await import('./storyHarness')).plansModuleMock());

const HARBORLINE_ID = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const LEDGER_ID = brandId<SessionId>({ value: 'session-ledger' });
const RELAY_ID = brandId<SessionId>({ value: 'session-relay' });
const PAYMENTS_ID = brandId<SessionId>({ value: 'session-payments' });
const NEWEST_UNREAD_ID = brandId<AgentId>({ value: 'agent-relay-2' });
const FULL_LIST_SQL = 'SELECT * FROM live_agents WHERE session_id IN';
const HEAVY_KEYS = [
  'outputSummary',
  'domains',
  'sourceThreadIds',
  'routingLock',
  'routingDecision',
  'taskProfile',
] as const;

type AtParams = {
  readonly minutes: number;
};

type SessionParams = {
  readonly sessionId: SessionId;
};

type StateParams = {
  readonly state: AppState;
  readonly sessionId: SessionId;
};

type RowsParams = {
  readonly state: AppState;
  readonly sessionId: SessionId;
  readonly rows: ReadonlyArray<Agent> | undefined;
};

let useAppStore: StoryStore;

const at = ({ minutes }: AtParams): IsoDateTime =>
  brandId<IsoDateTime>({
    value: new Date(Date.parse('2026-11-01T09:00:00.000Z') + minutes * 60_000).toISOString(),
  });

const rowsOf = ({ sessionId }: SessionParams): ReadonlyArray<Agent> =>
  useAppStore.getState().sessionPhaseRuns[sessionId] ?? [];

const textsOf = ({ sessionId }: SessionParams): ReadonlyArray<AgentId> =>
  rowsOf({ sessionId }).flatMap((agent) => (agent.outputSummary === undefined ? [] : [agent.id]));

const jsonFieldsOf = ({ sessionId }: SessionParams): number =>
  rowsOf({ sessionId }).filter((agent) =>
    HEAVY_KEYS.some((key) => key !== 'outputSummary' && key in agent),
  ).length;

const withRows = ({ state, sessionId, rows }: RowsParams): AppState => ({
  ...state,
  sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: rows ?? [] },
});

const labelOf = ({ state, sessionId }: StateParams) =>
  unreadLabelOf({ unread: unreadAgentsOf({ agents: state.sessionPhaseRuns[sessionId] }) });

const holdFullList = ({ sessionId }: SessionParams) => {
  const db = storySqlite();
  const select = db.select.bind(db);
  const gate = { open: (): void => undefined, fail: (_error: Error): void => undefined };
  const held = new Promise<void>((resolve, reject) => {
    gate.open = resolve;
    gate.fail = reject;
  });
  let isHeld = true;
  vi.spyOn(db, 'select').mockImplementation(async (sql, params) => {
    if (isHeld && sql.startsWith(FULL_LIST_SQL) && params?.[0] === sessionId) {
      isHeld = false;
      await held;
    }
    return select(sql, params);
  });
  return gate;
};

const seed = async (): Promise<void> => {
  const db = await openStorySqlite();
  await insertWorkspace({
    db,
    workspace: buildStoryWorkspace({ id: HARBORLINE_ID, name: 'Harborline', slug: 'harborline' }),
  });
  for (const [id, goal] of [
    [LEDGER_ID, 'Reconcile ledger-core'],
    [RELAY_ID, 'Retry notify-relay'],
    [PAYMENTS_ID, 'Settle payments-api'],
  ] as const) {
    await insertSession(db, buildStorySession({ id, workspaceId: HARBORLINE_ID, goal }));
  }
  await insertAgent(db, {
    id: brandId<AgentId>({ value: 'agent-ledger' }),
    sessionId: LEDGER_ID,
    ordinal: 0,
    name: 'implementer',
    status: 'completed',
    outputSummary: 'Reconciled the ledger export.',
    completedAt: at({ minutes: 1 }),
  });
  const relay = [
    { summary: 'Queued the notify-relay retries.', domains: undefined },
    { summary: 'Wired the retry backoff.', domains: undefined },
    { summary: 'Raised the batch size. Then checked it.', domains: ['notify-relay'] },
  ];
  for (const [ordinal, agent] of relay.entries()) {
    await insertAgent(db, {
      id: brandId<AgentId>({ value: `agent-relay-${ordinal}` }),
      sessionId: RELAY_ID,
      ordinal,
      name: `reviewer ${ordinal + 1}`,
      status: 'completed',
      outputSummary: agent.summary,
      completedAt: at({ minutes: ordinal + 2 }),
      sourceThreadIds: ['thread-7', 'thread-8'],
      ...(agent.domains !== undefined && { domains: agent.domains }),
    });
  }
  await db.execute('UPDATE agents SET last_viewed_at = ? WHERE id = ?', [
    Date.parse(at({ minutes: 9 })),
    'agent-relay-0',
  ]);
  await insertAgent(db, {
    id: brandId<AgentId>({ value: 'agent-payments' }),
    sessionId: PAYMENTS_ID,
    ordinal: 0,
    name: 'implementer',
    status: 'pending',
    outputSummary: 'Waiting on payments-api.',
  });
  await setSetting(db, SETTING_REOPEN_LAST, '1');
  await setSetting(db, SETTING_LAST_WORKSPACE_ID, HARBORLINE_ID);
  await setSetting(db, SETTING_LAST_SESSION_ID, LEDGER_ID);
};

const launch = async (): Promise<void> => {
  await useAppStore.getState().hydrate();
  await vi.waitFor(() => {
    expect(useAppStore.getState().lightAgentSessions[LEDGER_ID]).toBeUndefined();
  });
};

const openAndWait = async ({ sessionId }: SessionParams): Promise<void> => {
  await useAppStore.getState().setCurrentSession(sessionId);
  await vi.waitFor(() => {
    expect(useAppStore.getState().lightAgentSessions[sessionId]).toBeUndefined();
  });
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  sessionStorage.clear();
  await seed();
  stubStoryInvoke({ turn_list_live: () => [] });
  vi.stubGlobal('requestIdleCallback', (callback: () => void) => {
    queueMicrotask(callback);
    return 0;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('a launch loads light agent rows for the sessions it does not open', () => {
  it('reads no summary text but the newest unread one, and parses no JSON column', async () => {
    await launch();

    const state = useAppStore.getState();
    expect(state.currentSessionId).toBe(LEDGER_ID);
    expect(state.lightAgentSessions).toEqual({ [RELAY_ID]: true });
    expect(textsOf({ sessionId: RELAY_ID })).toEqual([NEWEST_UNREAD_ID]);
    expect(textsOf({ sessionId: RELAY_ID }).length).toBeLessThanOrEqual(
      BOOT_BUDGETS.summaryTextsPerUnopenedSessionAtLaunch,
    );
    expect(jsonFieldsOf({ sessionId: RELAY_ID })).toBe(
      BOOT_BUDGETS.jsonColumnsParsedPerUnopenedSessionAtLaunch,
    );
    expect(rowsOf({ sessionId: RELAY_ID }).map((agent) => agent.id)).toEqual([
      'agent-relay-0',
      'agent-relay-1',
      'agent-relay-2',
    ]);
  });

  it('loads the full rows at launch for a session with live work and for the one it opens', async () => {
    await launch();

    expect(textsOf({ sessionId: PAYMENTS_ID })).toEqual(['agent-payments']);
    expect(textsOf({ sessionId: LEDGER_ID })).toEqual(['agent-ledger']);
  });
});

describe('opening a session replaces its light rows with full rows', () => {
  it('fills the summaries and keeps every number and label the shell shows', async () => {
    await launch();
    const light = rowsOf({ sessionId: RELAY_ID });
    const lightLabel = labelOf({ state: useAppStore.getState(), sessionId: RELAY_ID });

    await openAndWait({ sessionId: RELAY_ID });

    const after = useAppStore.getState();
    const session = after.sessions.find((candidate) => candidate.id === RELAY_ID);
    if (session === undefined) {
      throw new Error('the relay session is missing');
    }
    const asLight = withRows({ state: after, sessionId: RELAY_ID, rows: light });
    expect(textsOf({ sessionId: RELAY_ID })).toHaveLength(3);
    expect(rowsOf({ sessionId: RELAY_ID }).at(2)?.domains).toEqual(['notify-relay']);
    expect(after.sessionLoading[RELAY_ID]?.agents).toBe(false);
    expect(stageInfoOf(asLight, session)).toEqual(stageInfoOf(after, session));
    expect(sessionHasUnread({ state: asLight, sessionId: RELAY_ID })).toBe(
      sessionHasUnread({ state: after, sessionId: RELAY_ID }),
    );
    expect(labelOf({ state: after, sessionId: RELAY_ID })).toBe(lightLabel);
    expect(lightLabel).toBe('2 new: Raised the batch size, and 1 more');
  });

  it('drops a late full list for a session the user left, and loads it again on return', async () => {
    await launch();
    const light = rowsOf({ sessionId: RELAY_ID });
    const gate = holdFullList({ sessionId: RELAY_ID });

    await useAppStore.getState().setCurrentSession(RELAY_ID);
    await useAppStore.getState().setCurrentSession(LEDGER_ID);
    gate.open();
    await vi.waitFor(() => {
      expect(useAppStore.getState().sessionLoading[RELAY_ID]?.agents).toBe(false);
    });

    expect(useAppStore.getState().lightAgentSessions[RELAY_ID]).toBe(true);
    expect(rowsOf({ sessionId: RELAY_ID })).toBe(light);

    await openAndWait({ sessionId: RELAY_ID });
    expect(textsOf({ sessionId: RELAY_ID })).toHaveLength(3);
  });

  it('keeps the light rows and shows the error when the full list fails, then Retry fills them', async () => {
    await launch();
    const light = rowsOf({ sessionId: RELAY_ID });
    const gate = holdFullList({ sessionId: RELAY_ID });

    await useAppStore.getState().setCurrentSession(RELAY_ID);
    gate.fail(new Error('database is locked'));
    await vi.waitFor(() => {
      expect(useAppStore.getState().sessionAgentsError[RELAY_ID]).toContain('database is locked');
    });

    expect(rowsOf({ sessionId: RELAY_ID })).toBe(light);
    expect(useAppStore.getState().sessionLoading[RELAY_ID]?.agents).toBe(false);

    await useAppStore.getState().openSessionAgents({ sessionId: RELAY_ID });
    expect(useAppStore.getState().sessionAgentsError[RELAY_ID]).toBeUndefined();
    expect(textsOf({ sessionId: RELAY_ID })).toHaveLength(3);
  });

  it('gives an engine the full rows of a session nobody opened', async () => {
    await launch();

    await useAppStore.getState().maybeAutoAdvanceWorkflow(RELAY_ID);

    expect(useAppStore.getState().currentSessionId).toBe(LEDGER_ID);
    expect(useAppStore.getState().lightAgentSessions[RELAY_ID]).toBeUndefined();
    expect(textsOf({ sessionId: RELAY_ID })).toHaveLength(3);
  });
});

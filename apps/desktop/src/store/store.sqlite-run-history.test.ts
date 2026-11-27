import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  insertAgent,
  insertAgentTurnSpan,
  insertProviderRun,
  insertSession,
  insertTelemetry,
  insertTurnEvent,
  insertWorkspace,
  setSetting,
} from '@goodboy/db';
import {
  brandId,
  type AgentId,
  type IsoDateTime,
  type ProviderRunId,
  type SessionId,
  type TelemetryRecordId,
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
import { agentSpendById } from '../features/session/timeline/agentSpendById';
import { switchEpoch } from './slices/workspaces/switchEpoch';

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
const LEDGER_LEAD_ID = brandId<AgentId>({ value: 'agent-ledger-lead' });
const LEDGER_HELPER_ID = brandId<AgentId>({ value: 'agent-ledger-helper' });
const RELAY_HELPER_ID = brandId<AgentId>({ value: 'agent-relay-helper' });
const HISTORY_SQL = "json_extract(payload, '$.runId') AS run_id";

type MinuteParams = {
  readonly minutes: number;
};

type RunSeedParams = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly runId: string;
  readonly costUsd: number;
  readonly minutes: number;
};

type SessionParams = {
  readonly sessionId: SessionId;
};

type AgentParams = {
  readonly agentId: AgentId;
};

let useAppStore: StoryStore;

const at = ({ minutes }: MinuteParams): IsoDateTime =>
  brandId<IsoDateTime>({
    value: new Date(Date.parse('2026-11-01T09:00:00.000Z') + minutes * 60_000).toISOString(),
  });

const runIdOf = (value: string): ProviderRunId => brandId<ProviderRunId>({ value });

const seedRun = async ({
  sessionId,
  agentId,
  runId,
  costUsd,
  minutes,
}: RunSeedParams): Promise<void> => {
  const db = storySqlite();
  const id = brandId<ProviderRunId>({ value: runId });
  await insertProviderRun(db, {
    id,
    sessionId,
    provider: 'anthropic',
    model: 'claude-sonnet-5',
    status: { kind: 'streaming', startedAt: at({ minutes }) },
    createdAt: at({ minutes }),
  });
  await insertTelemetry(db, {
    id: brandId<TelemetryRecordId>({ value: `telemetry-${runId}` }),
    runId: id,
    sessionId,
    kind: 'turn',
    provider: 'anthropic',
    model: 'claude-sonnet-5',
    inputTokens: 100,
    outputTokens: 20,
    estimatedCostUsd: costUsd,
    recordedAt: at({ minutes }),
  });
  await insertTurnEvent(db, {
    id: `event-${runId}`,
    sessionId,
    agentId,
    event: { kind: 'user_text', runId: id, text: 'Check ledger-core', at: at({ minutes }) },
  });
};

const spendOf = ({ sessionId, agentId }: SessionParams & AgentParams): number => {
  const state = useAppStore.getState();
  return (
    agentSpendById({
      records: state.sessionTelemetry[sessionId] ?? [],
      agents: state.sessionPhaseRuns[sessionId] ?? [],
      agentRunHistory: state.agentRunHistory,
    }).get(agentId) ?? 0
  );
};

const historyOf = ({ agentId }: AgentParams): ReadonlyArray<string> =>
  useAppStore.getState().agentRunHistory[agentId] ?? [];

const holdHistory = ({ sessionId }: SessionParams) => {
  const db = storySqlite();
  const select = db.select.bind(db);
  const gate = { open: (): void => undefined, fail: (_error: Error): void => undefined };
  const held = new Promise<void>((resolve, reject) => {
    gate.open = resolve;
    gate.fail = reject;
  });
  let isHeld = true;
  vi.spyOn(db, 'select').mockImplementation(async (sql, params) => {
    if (isHeld && sql.includes(HISTORY_SQL) && params?.[0] === sessionId) {
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
  ] as const) {
    await insertSession(db, buildStorySession({ id, workspaceId: HARBORLINE_ID, goal }));
  }
  await insertAgent(db, {
    id: LEDGER_LEAD_ID,
    sessionId: LEDGER_ID,
    ordinal: 0,
    name: 'lead',
    status: 'completed',
    completedAt: at({ minutes: 30 }),
  });
  await insertAgent(db, {
    id: LEDGER_HELPER_ID,
    sessionId: LEDGER_ID,
    parentAgentId: LEDGER_LEAD_ID,
    ordinal: 1,
    name: 'implementer',
    status: 'completed',
    completedAt: at({ minutes: 20 }),
  });
  await insertAgent(db, {
    id: RELAY_HELPER_ID,
    sessionId: RELAY_ID,
    ordinal: 0,
    name: 'implementer',
    status: 'completed',
    completedAt: at({ minutes: 5 }),
  });
  await seedRun({
    sessionId: LEDGER_ID,
    agentId: LEDGER_LEAD_ID,
    runId: 'run-lead',
    costUsd: 1,
    minutes: 1,
  });
  for (const [index, runId] of ['run-first', 'run-second', 'run-third'].entries()) {
    await seedRun({
      sessionId: LEDGER_ID,
      agentId: LEDGER_HELPER_ID,
      runId,
      costUsd: 0.25,
      minutes: index + 2,
    });
  }
  await db.execute('UPDATE agents SET provider_run_id = ? WHERE id = ?', [
    'run-third',
    LEDGER_HELPER_ID,
  ]);
  await db.execute('UPDATE agents SET provider_run_id = ? WHERE id = ?', [
    'run-lead',
    LEDGER_LEAD_ID,
  ]);
  for (const [index, runId] of ['run-relay-first', 'run-relay-second'].entries()) {
    await seedRun({
      sessionId: RELAY_ID,
      agentId: RELAY_HELPER_ID,
      runId,
      costUsd: 0.5,
      minutes: index + 1,
    });
  }
  await db.execute('UPDATE agents SET provider_run_id = ? WHERE id = ?', [
    'run-relay-second',
    RELAY_HELPER_ID,
  ]);
  await setSetting(db, SETTING_REOPEN_LAST, '1');
  await setSetting(db, SETTING_LAST_WORKSPACE_ID, HARBORLINE_ID);
  await setSetting(db, SETTING_LAST_SESSION_ID, LEDGER_ID);
};

const launch = async (): Promise<void> => {
  await useAppStore.getState().hydrate();
  await vi.waitFor(() => {
    expect(useAppStore.getState().sessionTelemetry[LEDGER_ID]).toBeDefined();
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

describe('every run of an agent counts, however its session was opened', () => {
  it('loads the earlier runs of a helper for the session reopened at launch', async () => {
    await launch();

    await vi.waitFor(() => {
      expect(historyOf({ agentId: LEDGER_HELPER_ID })).toEqual([
        'run-first',
        'run-second',
        'run-third',
      ]);
    });
    expect(spendOf({ sessionId: LEDGER_ID, agentId: LEDGER_HELPER_ID })).toBe(0.75);
    expect(spendOf({ sessionId: LEDGER_ID, agentId: LEDGER_LEAD_ID })).toBe(1.75);
  });

  it('loads them for a session the launch listed with light rows', async () => {
    await launch();

    await useAppStore.getState().setCurrentSession(RELAY_ID);

    await vi.waitFor(() => {
      expect(historyOf({ agentId: RELAY_HELPER_ID })).toEqual([
        'run-relay-first',
        'run-relay-second',
      ]);
    });
    await vi.waitFor(() => {
      expect(spendOf({ sessionId: RELAY_ID, agentId: RELAY_HELPER_ID })).toBe(1);
    });
  });

  it('counts a run whose transcript is gone but whose turn span is saved', async () => {
    const db = storySqlite();
    await insertAgentTurnSpan({
      db,
      span: {
        runId: runIdOf('run-first'),
        agentId: LEDGER_HELPER_ID,
        sessionId: LEDGER_ID,
        workspaceId: HARBORLINE_ID,
        workflowRunId: null,
        stepRole: 'implementer',
        provider: 'anthropic',
        model: 'claude-sonnet-5',
        effort: null,
        startedAt: at({ minutes: 2 }),
        endedAt: at({ minutes: 3 }),
        endReason: 'succeeded',
        touchedMountIds: [],
      },
    });
    await db.execute("DELETE FROM turn_events WHERE id = 'event-run-first'");

    await launch();

    await vi.waitFor(() => {
      expect(spendOf({ sessionId: LEDGER_ID, agentId: LEDGER_HELPER_ID })).toBe(0.75);
    });
  });

  it('keeps a run started while the saved history was still loading, as the newest', async () => {
    await launch();
    await vi.waitFor(() => {
      expect(historyOf({ agentId: LEDGER_HELPER_ID })).toHaveLength(3);
    });
    const gate = holdHistory({ sessionId: RELAY_ID });
    await useAppStore.getState().setCurrentSession(RELAY_ID);
    useAppStore.setState((state) => ({
      agentRunHistory: {
        ...state.agentRunHistory,
        [RELAY_HELPER_ID]: [runIdOf('run-relay-new')],
      },
    }));

    gate.open();

    await vi.waitFor(() => {
      expect(historyOf({ agentId: RELAY_HELPER_ID })).toEqual([
        'run-relay-first',
        'run-relay-second',
        'run-relay-new',
      ]);
    });
  });

  it('drops a history that answers after the developer switched workspace', async () => {
    await launch();
    const gate = holdHistory({ sessionId: RELAY_ID });
    const load = useAppStore.getState().loadSessionRunHistory({ sessionId: RELAY_ID });
    switchEpoch.value += 1;

    gate.open();
    await load;

    expect(historyOf({ agentId: RELAY_HELPER_ID })).toEqual([]);
  });

  it('stays quiet about a history that fails after the developer switched workspace', async () => {
    await launch();
    const gate = holdHistory({ sessionId: RELAY_ID });
    const load = useAppStore.getState().loadSessionRunHistory({ sessionId: RELAY_ID });
    switchEpoch.value += 1;

    gate.fail(new Error('database is locked'));
    await load;

    expect(useAppStore.getState().notifications.map((entry) => entry.title)).not.toContain(
      "Couldn't load the earlier runs",
    );
  });

  it('keeps what it has and says so when the history fails, then loads it on the next open', async () => {
    await launch();
    const gate = holdHistory({ sessionId: RELAY_ID });
    await useAppStore.getState().setCurrentSession(RELAY_ID);

    gate.fail(new Error('database is locked'));

    await vi.waitFor(() => {
      expect(useAppStore.getState().notifications.map((entry) => entry.title)).toContain(
        "Couldn't load the earlier runs",
      );
    });
    expect(historyOf({ agentId: RELAY_HELPER_ID })).toEqual([]);

    await useAppStore.getState().setCurrentSession(LEDGER_ID);
    await useAppStore.getState().setCurrentSession(RELAY_ID);
    await vi.waitFor(() => {
      expect(historyOf({ agentId: RELAY_HELPER_ID })).toEqual([
        'run-relay-first',
        'run-relay-second',
      ]);
    });
  });
});

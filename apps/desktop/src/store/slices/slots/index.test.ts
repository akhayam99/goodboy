// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';
import type {
  Agent,
  AgentId,
  ContextSlot,
  IsoDateTime,
  PlanId,
  PlanWithCount,
  ProviderRunId,
  Session,
  SessionId,
  TelemetryRecord,
  TelemetryRecordId,
  Workspace,
  WorkspaceId,
} from '@goodboy/types';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).dbLibModuleMock(),
);
vi.mock('../../../shared/lib/ls-to-db-migration', async () =>
  (await import('../../storyHarness')).lsToDbMigrationModuleMock(),
);
vi.mock('../../../features/onboarding/onboarding-store', async () =>
  (await import('../../storyHarness')).onboardingStoreModuleMock(),
);
vi.mock('../../../features/chat/turn', async () =>
  (await import('../../storyHarness')).turnModuleMock(),
);
vi.mock('../../../features/permissions/permissions', async () =>
  (await import('../../storyHarness')).permissionsModuleMock(),
);
vi.mock('../../../features/providers/providers', async () =>
  (await import('../../storyHarness')).providersModuleMock(),
);
vi.mock('../../../features/providers/routing', async () =>
  (await import('../../storyHarness')).routingModuleMock(),
);
vi.mock('../../../features/budget/budget', async () =>
  (await import('../../storyHarness')).budgetModuleMock(),
);
vi.mock('../../../features/skills/skills', async () =>
  (await import('../../storyHarness')).skillsModuleMock(),
);
vi.mock('../../../features/workflows/workflows', async () =>
  (await import('../../storyHarness')).workflowsModuleMock(),
);
vi.mock('../../../features/worktree/worktree', async () =>
  (await import('../../storyHarness')).worktreeModuleMock(),
);
vi.mock('../../../shared/lib/repo', async () =>
  (await import('../../storyHarness')).repoModuleMock(),
);
vi.mock('../../../shared/lib/editor', async () =>
  (await import('../../storyHarness')).editorModuleMock(),
);
vi.mock('../../../features/plans/plans', async () =>
  (await import('../../storyHarness')).plansModuleMock(),
);
vi.mock('../../../features/integrations/linear/client', async () =>
  (await import('../../storyHarness')).linearClientModuleMock(),
);
vi.mock('../../../features/github/github', async () =>
  (await import('../../storyHarness')).githubModuleMock(),
);
vi.mock('@goodboy/core', async (importOriginal) =>
  (await import('../../storyHarness')).coreModuleMock(importOriginal),
);
vi.mock('../../../features/scripts/scripts', async () =>
  (await import('../../storyHarness')).scriptsModuleMock(),
);
vi.mock('../../../features/terminal/terminal', async () =>
  (await import('../../storyHarness')).terminalModuleMock(),
);
vi.mock('../../../features/context/components/QuestionsTab/useOpenQuestions', async () =>
  (await import('../../storyHarness')).openQuestionsModuleMock(),
);
vi.mock('../../../features/settings/config-export', async () =>
  (await import('../../storyHarness')).configExportModuleMock(),
);

const WS_ID = 'workspace-1' as WorkspaceId;
const WS_ID_2 = 'workspace-2' as WorkspaceId;
const SESSION_ID = 'session-1' as SessionId;
const SESSION_ID_2 = 'session-2' as SessionId;
const AGENT_ID = 'agent-1' as AgentId;
const AGENT_ID_2 = 'agent-2' as AgentId;
const RUN_ID = 'run-1' as ProviderRunId;
const PLAN_ID = 'plan-1' as PlanId;
const NOW = '2026-05-28T00:00:00.000Z' as IsoDateTime;

function buildWorkspace(overrides: Partial<Workspace> = {}): Workspace {
  return {
    id: WS_ID,
    name: 'ws',
    slug: 'ws',
    overrides: {
      defaultProviderId: null,
      defaultWorkflowId: null,
      defaultBranchPrefix: null,
      parallelEnabled: null,
      defaultVerbosity: null,
      providerBindings: null,
      taskModels: null,
      roleModels: null,
      parallelAgents: null,
      providerPool: null,
      attributionFooter: null,
    },
    createdAt: NOW,
    updatedAt: NOW,
    lastAccessedAt: NOW,
    ...overrides,
  };
}

function buildSession(overrides: Partial<Session> = {}): Session {
  return {
    id: SESSION_ID,
    workspaceId: WS_ID,
    goal: 'do a thing',
    state: { kind: 'idle', lastActivityAt: NOW },
    contextSlots: [],
    providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: false },
    permissionMode: 'bypassPermissions',
    autoRun: false,
    titleUserEdited: false,
    workflowRuns: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function buildAgent(overrides: Partial<Agent> & Pick<Agent, 'id'>): Agent {
  return {
    sessionId: SESSION_ID,
    ordinal: 0,
    name: 'agent 1',
    status: 'pending',
    ...overrides,
  };
}

function buildPlan(overrides: Partial<PlanWithCount> = {}): PlanWithCount {
  return {
    id: PLAN_ID,
    sessionId: SESSION_ID,
    agentId: AGENT_ID,
    title: 't',
    bodyMd: 'b',
    status: 'active',
    consumptionCount: 0,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

describe('store contract', () => {
  beforeEach(async () => {
    await resetStoryStore();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('slots', () => {
    it('loadSessionSlots caches slots under sessionId', async () => {
      const store = useAppStore;
      const db = await import('@goodboy/db');
      (db.listContextSlotsForSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        { key: 'goal', value: 'g', enabled: true } as ContextSlot,
      ]);
      await store.getState().loadSessionSlots(SESSION_ID);
      expect(store.getState().sessionSlots[SESSION_ID]).toHaveLength(1);
    });

    it('records a completed read so an open can tell loaded from never read', async () => {
      const store = useAppStore;
      const db = await import('@goodboy/db');
      (db.listContextSlotsForSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        [],
      );
      await store.getState().loadSessionSlots(SESSION_ID);
      expect(store.getState().sessionSlotsLoad[SESSION_ID]).toBe('loaded');
    });

    it('records a rejected read as failed instead of leaving the session looking empty', async () => {
      const store = useAppStore;
      const db = await import('@goodboy/db');
      store.setState({
        sessionLoading: {
          [SESSION_ID]: {
            agents: false,
            transcript: false,
            telemetry: false,
            slots: true,
            plans: false,
            summary: false,
          },
        },
      });
      (db.listContextSlotsForSession as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('database is locked'),
      );
      const trace = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      await store.getState().loadSessionSlots(SESSION_ID);
      const traceCount = trace.mock.calls.length;
      trace.mockRestore();

      expect(store.getState().sessionSlotsLoad[SESSION_ID]).toBe('failed');
      expect(store.getState().sessionSlots[SESSION_ID]).toBeUndefined();
      expect(store.getState().sessionLoading[SESSION_ID]?.slots).toBe(false);
      expect(traceCount).toBe(1);
    });

    it('ensureSessionSlots reads the database once and reads it again after a failure', async () => {
      const store = useAppStore;
      const db = await import('@goodboy/db');
      const listSlots = db.listContextSlotsForSession as unknown as ReturnType<typeof vi.fn>;
      listSlots.mockRejectedValueOnce(new Error('database is locked'));
      const trace = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      const afterFailure = await store.getState().ensureSessionSlots(SESSION_ID);
      trace.mockRestore();
      expect(listSlots).toHaveBeenCalledTimes(1);
      expect(afterFailure).toEqual([]);

      listSlots.mockResolvedValueOnce([{ key: 'goal', value: 'g', enabled: true } as ContextSlot]);
      const afterLoad = await store.getState().ensureSessionSlots(SESSION_ID);
      expect(listSlots).toHaveBeenCalledTimes(2);
      expect(store.getState().sessionSlots[SESSION_ID]).toHaveLength(1);
      expect(afterLoad).toEqual([{ key: 'goal', value: 'g', enabled: true }]);

      const cached = await store.getState().ensureSessionSlots(SESSION_ID);
      expect(listSlots).toHaveBeenCalledTimes(2);
      expect(cached).toEqual([{ key: 'goal', value: 'g', enabled: true }]);
    });

    it('reads the database once when the switch and the pane both ask at once', async () => {
      const store = useAppStore;
      const db = await import('@goodboy/db');
      const listSlots = db.listContextSlotsForSession as unknown as ReturnType<typeof vi.fn>;
      listSlots.mockResolvedValue([{ key: 'goal', value: 'g', enabled: true } as ContextSlot]);

      const [first, second] = await Promise.all([
        store.getState().ensureSessionSlots(SESSION_ID),
        store.getState().ensureSessionSlots(SESSION_ID),
      ]);

      expect(listSlots).toHaveBeenCalledTimes(1);
      expect(store.getState().sessionSlotsLoad[SESSION_ID]).toBe('loaded');
      expect(first).toEqual([{ key: 'goal', value: 'g', enabled: true }]);
      expect(second).toEqual([{ key: 'goal', value: 'g', enabled: true }]);
    });

    it('marks the read in flight so a retry is not mistaken for the failure it replaces', async () => {
      const store = useAppStore;
      const db = await import('@goodboy/db');
      const listSlots = db.listContextSlotsForSession as unknown as ReturnType<typeof vi.fn>;
      let release: (slots: ReadonlyArray<ContextSlot>) => void = () => undefined;
      listSlots.mockReturnValueOnce(
        new Promise<ReadonlyArray<ContextSlot>>((resolve) => {
          release = resolve;
        }),
      );

      const read = store.getState().loadSessionSlots(SESSION_ID);
      expect(store.getState().sessionLoading[SESSION_ID]?.slots).toBe(true);

      release([]);
      await read;
      expect(store.getState().sessionLoading[SESSION_ID]?.slots).toBe(false);
    });

    it('toggleSessionSlot upserts the slot with new enabled flag', async () => {
      const store = useAppStore;
      const db = await import('@goodboy/db');
      store.setState({
        sessionSlots: { [SESSION_ID]: [{ key: 'goal', value: 'g', enabled: true } as ContextSlot] },
      });
      await store.getState().toggleSessionSlot(SESSION_ID, 'goal', false);
      const slot = store.getState().sessionSlots[SESSION_ID]?.find((s) => s.key === 'goal');
      expect(slot?.enabled).toBe(false);
      expect(db.upsertContextSlot).toHaveBeenCalledWith(
        expect.anything(),
        SESSION_ID,
        { key: 'goal', value: 'g', enabled: false },
        'user',
      );
    });
  });

  describe('telemetry', () => {
    it('loadSessionTelemetry caches the records', async () => {
      const store = useAppStore;
      const rec = {
        id: 'tr-1' as TelemetryRecordId,
        runId: RUN_ID,
        sessionId: SESSION_ID,
        kind: 'turn',
        provider: 'anthropic',
        model: 'm',
        inputTokens: 1,
        outputTokens: 1,
        estimatedCostUsd: 0.01,
        recordedAt: NOW,
      } as TelemetryRecord;
      const db = await import('@goodboy/db');
      (db.listTelemetryForSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        rec,
      ]);
      await store.getState().loadSessionTelemetry(SESSION_ID);
      expect(store.getState().sessionTelemetry[SESSION_ID]).toEqual([rec]);
    });
  });
});

// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../storyHarness';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  PlanId,
  PlanWithCount,
  ProviderRunId,
  Session,
  SessionId,
  TurnEvent,
  Workspace,
  WorkspaceId,
} from '@goodboy/types';
import { purgedAgentIds } from '../../session-mutators';
import { flushTurnEvents } from './buffer';

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
    purgedAgentIds.clear();
  });

  describe('transcripts', () => {
    it('appendTurnEvent pushes an event onto the agent transcript', async () => {
      const store = useAppStore;
      store.setState({
        sessions: [buildSession()],
        sessionPhaseRuns: { [SESSION_ID]: [buildAgent({ id: AGENT_ID })] },
      });
      const ev: TurnEvent = {
        kind: 'assistant_text',
        runId: RUN_ID,
        delta: 'hi',
        at: NOW,
      } as TurnEvent;
      store.getState().appendTurnEvent(AGENT_ID, SESSION_ID, ev);
      expect(store.getState().transcripts[AGENT_ID]).toEqual([ev]);
    });

    it('resetTranscript clears the per-agent transcript', async () => {
      const store = useAppStore;
      const ev: TurnEvent = {
        kind: 'assistant_text',
        runId: RUN_ID,
        delta: 'x',
        at: NOW,
      } as TurnEvent;
      store.setState({ transcripts: { [AGENT_ID]: [ev] } });
      store.getState().resetTranscript(AGENT_ID);
      expect(store.getState().transcripts[AGENT_ID]).toEqual([]);
    });

    it('appendTurnEvent bumps unknownPayloadCounts for unknown_payload events', async () => {
      const store = useAppStore;
      store.setState({
        sessions: [buildSession()],
        sessionPhaseRuns: { [SESSION_ID]: [buildAgent({ id: AGENT_ID })] },
      });
      const ev: TurnEvent = {
        kind: 'unknown_payload',
        runId: RUN_ID,
        adapter: 'anthropic',
        payloadType: 'foo',
        raw: '{}',
        at: NOW,
      } as TurnEvent;
      store.getState().appendTurnEvent(AGENT_ID, SESSION_ID, ev);
      expect(store.getState().unknownPayloadCounts['anthropic:foo']).toBe(1);
    });

    it('a deleted agent does not come back when the buffered events flush', async () => {
      const store = useAppStore;
      store.setState({
        sessions: [buildSession()],
        sessionPhaseRuns: { [SESSION_ID]: [buildAgent({ id: AGENT_ID })] },
      });
      const first: TurnEvent = {
        kind: 'assistant_text',
        runId: RUN_ID,
        delta: 'a',
        at: NOW,
      } as TurnEvent;
      const second: TurnEvent = {
        kind: 'assistant_text',
        runId: RUN_ID,
        delta: 'b',
        at: NOW,
      } as TurnEvent;
      vi.useFakeTimers();
      try {
        store.getState().appendTurnEvent(AGENT_ID, SESSION_ID, first);
        store.getState().appendTurnEvent(AGENT_ID, SESSION_ID, second);
        await store.getState().deleteAgent(SESSION_ID, AGENT_ID);
        vi.advanceTimersByTime(64);
      } finally {
        vi.useRealTimers();
      }
      expect(store.getState().transcripts[AGENT_ID]).toBeUndefined();
    });

    it('a deleted agent does not come back when a late event arrives after the purge', async () => {
      const store = useAppStore;
      store.setState({
        sessions: [buildSession()],
        sessionPhaseRuns: { [SESSION_ID]: [buildAgent({ id: AGENT_ID })] },
      });
      await store.getState().deleteAgent(SESSION_ID, AGENT_ID);
      const late: TurnEvent = {
        kind: 'assistant_text',
        runId: RUN_ID,
        delta: 'late',
        at: NOW,
      } as TurnEvent;
      store.getState().appendTurnEvent(AGENT_ID, SESSION_ID, late);
      flushTurnEvents();
      expect(store.getState().transcripts[AGENT_ID]).toBeUndefined();
    });

    it('provider_session_init stamps providerSessionId on the run and persists once', async () => {
      const store = useAppStore;
      store.setState({
        sessions: [buildSession()],
        sessionPhaseRuns: { [SESSION_ID]: [buildAgent({ id: AGENT_ID })] },
      });
      const ev: TurnEvent = {
        kind: 'provider_session_init',
        runId: RUN_ID,
        providerSessionId: 'sess-xyz',
        provider: 'anthropic',
        at: NOW,
      } as TurnEvent;
      store.getState().appendTurnEvent(AGENT_ID, SESSION_ID, ev);
      const run = store.getState().sessionPhaseRuns[SESSION_ID]?.find((r) => r.id === AGENT_ID);
      expect(run?.providerSessionId).toBe('sess-xyz');
      expect(run?.providerSessionProviderId).toBe('anthropic');
      expect(storySpies.invokeAgentSetProviderSessionId).toHaveBeenCalledTimes(1);
      expect(storySpies.invokeAgentSetProviderSessionId).toHaveBeenCalledWith({
        id: AGENT_ID,
        providerSessionId: 'sess-xyz',
        providerSessionProviderId: 'anthropic',
      });
    });
  });
});

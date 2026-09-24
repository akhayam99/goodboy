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

  describe('agents', () => {
    it('setAgentDraft stores per-agent text', async () => {
      const store = useAppStore;
      store.getState().setAgentDraft(AGENT_ID, 'wip');
      expect(store.getState().agentDraft[AGENT_ID]).toBe('wip');
    });

    it('clearAgentDraft removes the per-agent entry', async () => {
      const store = useAppStore;
      store.setState({ agentDraft: { [AGENT_ID]: 'wip' } });
      store.getState().clearAgentDraft(AGENT_ID);
      expect(store.getState().agentDraft[AGENT_ID]).toBeUndefined();
    });

    it('setAgentKind stores override and persists', async () => {
      const store = useAppStore;
      store.getState().setAgentKind(AGENT_ID, 'implementer');
      expect(store.getState().agentKindOverride[AGENT_ID]).toBe('implementer');
      const { kindRouting } = await import('../../../features/session/agent-kind');
      expect(store.getState().agentModelOverride[AGENT_ID]).toBe(
        kindRouting({ kind: 'implementer' }).model,
      );
      expect(storySpies.invokeAgentSetKind).toHaveBeenCalledWith(AGENT_ID, 'implementer');
    });

    it('setAgentKind clears a stale provider pin when reseeding the model', async () => {
      const store = useAppStore;
      store.setState({ agentProviderOverride: { [AGENT_ID]: 'codex' } });
      store.getState().setAgentKind(AGENT_ID, 'implementer');
      expect(store.getState().agentProviderOverride[AGENT_ID]).toBeUndefined();
    });

    it('setAgentEffortOverride pins the per-agent effort', async () => {
      const store = useAppStore;
      store.getState().setAgentEffortOverride(AGENT_ID, 'xhigh');
      expect(store.getState().agentEffortOverride[AGENT_ID]).toBe('xhigh');
    });

    it('setAgentKind clears a stale effort pin when reseeding the model', async () => {
      const store = useAppStore;
      store.setState({ agentEffortOverride: { [AGENT_ID]: 'max' } });
      store.getState().setAgentKind(AGENT_ID, 'implementer');
      expect(store.getState().agentEffortOverride[AGENT_ID]).toBeUndefined();
    });

    it('markAgentViewed no-ops when the agent has no lastFinishedAt', async () => {
      const store = useAppStore;
      const agent = buildAgent({ id: AGENT_ID });
      store.setState({ sessionPhaseRuns: { [SESSION_ID]: [agent] } });
      await store.getState().markAgentViewed(SESSION_ID, AGENT_ID);
      expect(storySpies.invokeAgentMarkViewed).not.toHaveBeenCalled();
    });

    it('sets and clears the user-controlled done timestamp', async () => {
      const store = useAppStore;
      const agent = buildAgent({ id: AGENT_ID });
      store.setState({ sessionPhaseRuns: { [SESSION_ID]: [agent] } });

      await store.getState().setAgentDone(SESSION_ID, AGENT_ID);

      expect(store.getState().sessionPhaseRuns[SESSION_ID]?.[0]?.doneAt).toBeDefined();
      expect(storySpies.invokeAgentSetDone).toHaveBeenCalledWith(
        AGENT_ID,
        true,
        expect.any(String),
      );

      await store.getState().clearAgentDone(SESSION_ID, AGENT_ID);

      expect(store.getState().sessionPhaseRuns[SESSION_ID]?.[0]?.doneAt).toBeUndefined();
      expect(storySpies.invokeAgentSetDone).toHaveBeenCalledWith(AGENT_ID, false, null);
    });

    it('keeps the agent done when an agent list reload lands while the write is in flight', async () => {
      const store = useAppStore;
      const agent = buildAgent({ id: AGENT_ID, status: 'running' });
      store.setState({ sessionPhaseRuns: { [SESSION_ID]: [agent] } });
      storySpies.invokeAgentSetDone.mockImplementationOnce(async () => {
        store.setState({ sessionPhaseRuns: { [SESSION_ID]: [agent] } });
      });

      await store.getState().setAgentDone(SESSION_ID, AGENT_ID);

      expect(store.getState().sessionPhaseRuns[SESSION_ID]?.[0]?.doneAt).toBeDefined();
    });

    it('reopens the agent and reports it when the done write fails', async () => {
      const store = useAppStore;
      const agent = buildAgent({ id: AGENT_ID });
      store.setState({ sessionPhaseRuns: { [SESSION_ID]: [agent] }, notifications: [] });
      storySpies.invokeAgentSetDone.mockRejectedValueOnce(new Error('agent row is gone'));

      await store.getState().setAgentDone(SESSION_ID, AGENT_ID);

      expect(store.getState().sessionPhaseRuns[SESSION_ID]?.[0]?.doneAt).toBeUndefined();
      expect(store.getState().notifications[0]?.title).toBe("Couldn't mark this agent done");
    });

    it('markAgentViewed stamps lastViewedAt and invokes persist when finished is newer than viewed', async () => {
      const store = useAppStore;
      const finishedAt = '2026-05-28T01:00:00.000Z' as IsoDateTime;
      const agent = buildAgent({
        id: AGENT_ID,
        status: 'completed',
        lastFinishedAt: finishedAt,
        lastViewedAt: undefined as never,
      });
      store.setState({ sessionPhaseRuns: { [SESSION_ID]: [agent] } });
      await store.getState().markAgentViewed(SESSION_ID, AGENT_ID);
      expect(storySpies.invokeAgentMarkViewed).toHaveBeenCalled();
      const updated = store.getState().sessionPhaseRuns[SESSION_ID]?.[0];
      expect(updated?.lastViewedAt).toBeDefined();
    });
  });
});

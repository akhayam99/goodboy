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
  PlanConsumption,
  PlanConsumptionId,
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
    sessionsRoot: '/tmp/repo',
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

  describe('plans', () => {
    it('loadSessionPlans fills sessionPlans[sid] from DB', async () => {
      const store = useAppStore;
      storySpies.listPlansForSession.mockResolvedValueOnce([buildPlan()]);
      await store.getState().loadSessionPlans(SESSION_ID);
      expect(store.getState().sessionPlans[SESSION_ID]).toHaveLength(1);
    });

    it('setPlanStatus persists and refreshes the plans cache', async () => {
      const store = useAppStore;
      storySpies.listPlansForSession.mockResolvedValueOnce([buildPlan({ status: 'discarded' })]);
      await store.getState().setPlanStatus(SESSION_ID, PLAN_ID, 'discarded');
      expect(storySpies.setPlanStatus).toHaveBeenCalledWith(PLAN_ID, 'discarded');
      expect(store.getState().sessionPlans[SESSION_ID]?.[0]?.status).toBe('discarded');
    });

    it('updatePlanBody pushes through invokeSetPlanBody and refreshes', async () => {
      const store = useAppStore;
      storySpies.listPlansForSession.mockResolvedValueOnce([
        buildPlan({ title: 'x', bodyMd: 'y' }),
      ]);
      await store.getState().updatePlanBody(SESSION_ID, PLAN_ID, 'x', 'y');
      expect(storySpies.setPlanBody).toHaveBeenCalledWith(PLAN_ID, 'x', 'y');
      expect(store.getState().sessionPlans[SESSION_ID]?.[0]?.title).toBe('x');
    });

    it('deletePlan flips status to discarded', async () => {
      const store = useAppStore;
      storySpies.listPlansForSession.mockResolvedValueOnce([]);
      await store.getState().deletePlan(SESSION_ID, PLAN_ID);
      expect(storySpies.setPlanStatus).toHaveBeenCalledWith(PLAN_ID, 'discarded');
    });

    it('restorePlan flips status back to active', async () => {
      const store = useAppStore;
      storySpies.listPlansForSession.mockResolvedValueOnce([]);
      await store.getState().restorePlan(SESSION_ID, PLAN_ID);
      expect(storySpies.setPlanStatus).toHaveBeenCalledWith(PLAN_ID, 'active');
    });

    it('loadConsumptionsForPlan caches results keyed by planId', async () => {
      const store = useAppStore;
      const fakeCon = {
        id: 'c-1' as PlanConsumptionId,
        planId: PLAN_ID,
        agentId: AGENT_ID,
        consumedAt: NOW,
      } as PlanConsumption;
      storySpies.listConsumptionsForPlan.mockResolvedValueOnce([fakeCon]);
      await store.getState().loadConsumptionsForPlan(PLAN_ID);
      expect(store.getState().planConsumptions[PLAN_ID]).toEqual([fakeCon]);
    });
  });
});

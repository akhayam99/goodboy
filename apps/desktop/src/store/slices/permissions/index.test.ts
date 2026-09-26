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
      replyVoice: null,
      replyStyleNote: null,
      replyTemplateFixed: null,
      replyTemplateNoChange: null,
      resolveOnGithub: null,
      resolveCommitStyle: null,
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

  describe('permissions', () => {
    it('resolvePermissionRequest(scope=once) adds toolUseId to volatilePermissionAllows', async () => {
      const store = useAppStore;
      store.setState({ sessions: [buildSession()] });
      await store.getState().resolvePermissionRequest({
        sessionId: SESSION_ID,
        agentId: AGENT_ID,
        toolUseId: 'tu-1',
        toolName: 'Bash',
        runId: RUN_ID,
        scope: 'once',
      });
      expect(store.getState().volatilePermissionAllows.has('tu-1')).toBe(true);
    });

    it('resolvePermissionRequest(scope=session) calls invokePermissionRuleUpsert with session scope', async () => {
      const store = useAppStore;
      store.setState({ sessions: [buildSession()] });
      const perm = await import('../../../features/permissions/permissions');
      await store.getState().resolvePermissionRequest({
        sessionId: SESSION_ID,
        agentId: AGENT_ID,
        toolUseId: 'tu-2',
        toolName: 'Edit',
        runId: RUN_ID,
        scope: 'session',
      });
      expect(perm.invokePermissionRuleUpsert).toHaveBeenCalledWith(
        expect.objectContaining({ scope: 'session', sessionId: SESSION_ID, decision: 'allow' }),
      );
    });

    it('resolvePermissionRequest(scope=deny) maps to a session-scoped deny rule', async () => {
      const store = useAppStore;
      store.setState({ sessions: [buildSession()] });
      const perm = await import('../../../features/permissions/permissions');
      await store.getState().resolvePermissionRequest({
        sessionId: SESSION_ID,
        agentId: AGENT_ID,
        toolUseId: 'tu-3',
        toolName: 'Bash',
        runId: RUN_ID,
        scope: 'deny',
      });
      expect(perm.invokePermissionRuleUpsert).toHaveBeenCalledWith(
        expect.objectContaining({ scope: 'session', decision: 'deny' }),
      );
    });

    it('resolvePermissionRequest no-ops when session is missing', async () => {
      const store = useAppStore;
      const perm = await import('../../../features/permissions/permissions');
      await store.getState().resolvePermissionRequest({
        sessionId: 'ghost' as SessionId,
        agentId: AGENT_ID,
        toolUseId: 't',
        toolName: 'Edit',
        runId: RUN_ID,
        scope: 'workspace',
      });
      expect(perm.invokePermissionRuleUpsert).not.toHaveBeenCalled();
    });

    it('resolvePermissionRequest(pattern) sends the command-prefix pattern, not a blanket allow', async () => {
      const store = useAppStore;
      store.setState({ sessions: [buildSession()] });
      const perm = await import('../../../features/permissions/permissions');
      await store.getState().resolvePermissionRequest({
        sessionId: SESSION_ID,
        agentId: AGENT_ID,
        toolUseId: 'tu-4',
        toolName: 'Bash',
        runId: RUN_ID,
        scope: 'workspace',
        pattern: { tool: 'Bash', argsMatcher: 'pnpm test *' },
      });
      expect(perm.invokePermissionRuleUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: 'workspace',
          patternTool: 'Bash',
          patternArgsMatcher: 'pnpm test *',
          decision: 'allow',
        }),
      );
    });
  });
});

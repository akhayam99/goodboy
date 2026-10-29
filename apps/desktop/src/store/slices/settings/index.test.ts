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
import { brandId } from '@goodboy/types';

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
vi.mock('../../../features/onboarding/onboardingSettings', async () =>
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
vi.mock('../../../features/integrations/github/github', async () =>
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
vi.mock('../../../features/settings/config-export', async () =>
  (await import('../../storyHarness')).configExportModuleMock(),
);

const WS_ID = brandId<WorkspaceId>({ value: 'workspace-1' });
const WS_ID_2 = brandId<WorkspaceId>({ value: 'workspace-2' });
const SESSION_ID = brandId<SessionId>({ value: 'session-1' });
const SESSION_ID_2 = brandId<SessionId>({ value: 'session-2' });
const AGENT_ID = brandId<AgentId>({ value: 'agent-1' });
const AGENT_ID_2 = brandId<AgentId>({ value: 'agent-2' });
const RUN_ID = brandId<ProviderRunId>({ value: 'run-1' });
const PLAN_ID = brandId<PlanId>({ value: 'plan-1' });
const NOW = brandId<IsoDateTime>({ value: '2026-05-28T00:00:00.000Z' });

function buildWorkspace(overrides: Partial<Workspace> = {}): Workspace {
  return {
    id: WS_ID,
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

  describe('settings', () => {
    it('loadSetting writes the value into settings map when DB returns a string', async () => {
      const store = useAppStore;
      storySpies.getSetting.mockResolvedValueOnce('val');
      const out = await store.getState().loadSetting('k');
      expect(out).toBe('val');
      expect(store.getState().settings['k']).toBe('val');
    });

    it('loadSetting leaves settings untouched when DB returns null', async () => {
      const store = useAppStore;
      storySpies.getSetting.mockResolvedValueOnce(null);
      const out = await store.getState().loadSetting('k');
      expect(out).toBeNull();
      expect(store.getState().settings['k']).toBeUndefined();
    });

    it('loadSetting keeps the settings object when the stored value is unchanged', async () => {
      const store = useAppStore;
      storySpies.getSetting.mockResolvedValueOnce('val');
      await store.getState().loadSetting('k');
      const before = store.getState().settings;
      const listener = vi.fn();
      const unsubscribe = store.subscribe(listener);
      storySpies.getSetting.mockResolvedValueOnce('val');
      await store.getState().loadSetting('k');
      unsubscribe();
      expect(store.getState().settings).toBe(before);
      expect(listener).not.toHaveBeenCalled();
    });

    it('loadSetting replaces the settings object when the stored value changed', async () => {
      const store = useAppStore;
      storySpies.getSetting.mockResolvedValueOnce('one');
      await store.getState().loadSetting('k');
      const before = store.getState().settings;
      storySpies.getSetting.mockResolvedValueOnce('two');
      await store.getState().loadSetting('k');
      expect(store.getState().settings).not.toBe(before);
      expect(store.getState().settings['k']).toBe('two');
    });

    it('saveSetting persists and caches', async () => {
      const store = useAppStore;
      await store.getState().saveSetting('k', 'v');
      expect(storySpies.setSetting).toHaveBeenCalled();
      expect(store.getState().settings['k']).toBe('v');
    });
  });
});

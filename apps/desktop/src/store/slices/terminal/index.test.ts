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
  MountId,
  ProjectId,
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
vi.mock('../../../shared/components/GenericTerminalPanel/outputCache', async () =>
  (await import('../../storyHarness')).terminalOutputCacheModuleMock(),
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

  describe('terminal', () => {
    it('openTerminal marks the session as open', async () => {
      const store = useAppStore;
      await store.getState().openTerminal(SESSION_ID, '/cwd', 80, 24);
      expect(store.getState().terminalSessions[SESSION_ID]).toBe('open');
    });

    it('closeTerminal marks the session as closed', async () => {
      const store = useAppStore;
      store.setState({ terminalSessions: { [SESSION_ID]: 'open' } });
      await store.getState().closeTerminal(SESSION_ID);
      expect(store.getState().terminalSessions[SESSION_ID]).toBe('closed');
    });
  });

  describe('terminal cmux', () => {
    it('addTerminalTab appends a tab, sets it active, and returns the id', async () => {
      const store = useAppStore;
      const id = store.getState().addTerminalTab(SESSION_ID, '/cwd');
      const tabs = store.getState().terminalTabs[SESSION_ID] ?? [];
      expect(tabs).toHaveLength(1);
      expect(tabs[0]?.id).toBe(id);
      expect(tabs[0]?.status).toBe('running');
      expect(store.getState().activeTerminalTab[SESSION_ID]).toBe(id);
    });

    it('a second addTerminalTab allocates a distinct id and becomes active', async () => {
      const store = useAppStore;
      const first = store.getState().addTerminalTab(SESSION_ID, null);
      const second = store.getState().addTerminalTab(SESSION_ID, null);
      expect(second).not.toBe(first);
      expect(store.getState().terminalTabs[SESSION_ID]).toHaveLength(2);
      expect(store.getState().activeTerminalTab[SESSION_ID]).toBe(second);
    });

    it('reattaches live terminal tabs and makes the first tab active', async () => {
      const store = useAppStore;
      storySpies.invokeTerminalListLive.mockResolvedValueOnce([
        { id: `${SESSION_ID}::t2`, cwd: '/worktrees/api' },
        { id: `${SESSION_ID}::t1`, cwd: '/worktrees/api' },
      ]);

      await store.getState().reattachTerminalTabs();

      const tabs = store.getState().terminalTabs[SESSION_ID] ?? [];
      expect(tabs.map((tab) => tab.id)).toEqual([`${SESSION_ID}::t1`, `${SESSION_ID}::t2`]);
      expect(store.getState().activeTerminalTab[SESSION_ID]).toBe(`${SESSION_ID}::t1`);
    });

    it('addTerminalTab tags the tab with the mount that owns the cwd', async () => {
      const store = useAppStore;
      store.setState({
        sessionActiveProject: { [SESSION_ID]: 'api' as ProjectId },
        sessionProjectMounts: {
          [SESSION_ID]: [
            {
              mountId: 'mount-web' as MountId,
              projectId: 'web' as ProjectId,
              mountName: 'WEB',
              worktreePath: '/worktrees/web',
              repoRoot: '/repo/web',
              branch: 'feat/web',
              sessionId: SESSION_ID,
              lastWorktreePath: null,
              baseBranch: null,
              parallelIndex: 0,
              isAttached: true,
              diskState: 'present',
              revision: 0,
            },
            {
              mountId: 'mount-api' as MountId,
              projectId: 'api' as ProjectId,
              mountName: 'API',
              worktreePath: '/worktrees/api',
              repoRoot: '/repo/api',
              branch: 'feat/api',
              sessionId: SESSION_ID,
              lastWorktreePath: null,
              baseBranch: null,
              parallelIndex: 0,
              isAttached: true,
              diskState: 'present',
              revision: 0,
            },
          ],
        },
      });

      const id = store.getState().addTerminalTab(SESSION_ID, '/worktrees/api');

      const tab = (store.getState().terminalTabs[SESSION_ID] ?? []).find(
        (candidate) => candidate.id === id,
      );
      expect(tab?.projectId).toBe('api');
      expect(tab?.mountId).toBe('mount-api');
    });

    it('addTerminalTab leaves the project undefined when the session has no active project', async () => {
      const store = useAppStore;
      const id = store.getState().addTerminalTab(SESSION_ID, null);
      const tab = (store.getState().terminalTabs[SESSION_ID] ?? []).find(
        (candidate) => candidate.id === id,
      );
      expect(tab?.projectId).toBeUndefined();
    });

    it('a reattached tab regains its project from the cwd of the live terminal', async () => {
      const store = useAppStore;
      store.setState({
        sessionProjectMounts: {
          [SESSION_ID]: [
            {
              mountId: 'mount-api' as MountId,
              projectId: 'api' as ProjectId,
              mountName: 'API',
              worktreePath: '/worktrees/api',
              repoRoot: '/repo/api',
              branch: 'feat/api',
              sessionId: SESSION_ID,
              lastWorktreePath: null,
              baseBranch: null,
              parallelIndex: 0,
              isAttached: true,
              diskState: 'present',
              revision: 0,
            },
          ],
        },
      });
      storySpies.invokeTerminalListLive.mockResolvedValueOnce([
        { id: `${SESSION_ID}::t1`, cwd: '/worktrees/api' },
        { id: `${SESSION_ID}::t2`, cwd: '/somewhere/else' },
      ]);

      await store.getState().reattachTerminalTabs();

      const tabs = store.getState().terminalTabs[SESSION_ID] ?? [];
      expect(tabs.map((tab) => tab.projectId)).toEqual(['api', undefined]);
      expect(tabs.map((tab) => tab.mountId)).toEqual(['mount-api', undefined]);
      expect(tabs.map((tab) => tab.cwd)).toEqual(['/worktrees/api', '/somewhere/else']);
    });

    it('setActiveTerminalTab switches the active tab', async () => {
      const store = useAppStore;
      const first = store.getState().addTerminalTab(SESSION_ID, null);
      store.getState().addTerminalTab(SESSION_ID, null);
      store.getState().setActiveTerminalTab(SESSION_ID, first);
      expect(store.getState().activeTerminalTab[SESSION_ID]).toBe(first);
    });

    it('setTerminalTabStatus updates the tab status', async () => {
      const store = useAppStore;
      const id = store.getState().addTerminalTab(SESSION_ID, null);
      store.getState().setTerminalTabStatus(SESSION_ID, id, 'exited');
      const tabs = store.getState().terminalTabs[SESSION_ID] ?? [];
      expect(tabs[0]?.status).toBe('exited');
    });

    it('closeTerminalTab removes the tab and reassigns active', async () => {
      const store = useAppStore;
      const first = store.getState().addTerminalTab(SESSION_ID, null);
      const second = store.getState().addTerminalTab(SESSION_ID, null);
      store.getState().closeTerminalTab(SESSION_ID, second);
      const tabs = store.getState().terminalTabs[SESSION_ID] ?? [];
      expect(tabs).toHaveLength(1);
      expect(tabs[0]?.id).toBe(first);
      expect(store.getState().activeTerminalTab[SESSION_ID]).toBe(first);
    });

    it('closeSessionTerminals clears the session tabs', async () => {
      const store = useAppStore;
      store.getState().addTerminalTab(SESSION_ID, null);
      store.getState().addTerminalTab(SESSION_ID, null);
      await store.getState().closeSessionTerminals(SESSION_ID);
      expect(store.getState().terminalTabs[SESSION_ID]).toBeUndefined();
      expect(store.getState().activeTerminalTab[SESSION_ID]).toBeUndefined();
    });

    it('closeSessionTerminals settles only once every shell has been told to close', async () => {
      const store = useAppStore;
      store.getState().addTerminalTab(SESSION_ID, null);
      let shellIsDown = false;
      storySpies.invokeTerminalClose.mockImplementationOnce(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        shellIsDown = true;
        return undefined;
      });

      await store.getState().closeSessionTerminals(SESSION_ID);

      expect(shellIsDown).toBe(true);
    });
  });
});

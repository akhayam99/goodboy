// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { sessionTerminalOwner, workspaceTerminalOwner } from './terminalOwner';
import {
  STORE_IMPORT_TIMEOUT_MS,
  emitTerminalExit,
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
vi.mock('../../../features/terminal/outputBus', async () =>
  (await import('../../storyHarness')).terminalOutputBusModuleMock(),
);
vi.mock('../../../features/settings/config-export', async () =>
  (await import('../../storyHarness')).configExportModuleMock(),
);

const WS_ID = 'workspace-1' as WorkspaceId;
const WS_ID_2 = 'workspace-2' as WorkspaceId;
const SESSION_ID = 'session-1' as SessionId;
const SESSION_ID_2 = 'session-2' as SessionId;
const SESSION_OWNER = sessionTerminalOwner({ sessionId: SESSION_ID });
const WORKSPACE_OWNER = workspaceTerminalOwner({ workspaceId: WS_ID });
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

  describe('terminal', () => {
    it('openTerminal marks the session as open', async () => {
      const store = useAppStore;
      await store.getState().openTerminal(SESSION_ID, '/cwd', 80, 24);
      expect(store.getState().terminalSessions[SESSION_ID]).toBe('open');
    });
  });

  describe('terminal cmux', () => {
    it('addTerminalTab appends a tab, sets it active, and returns the id', async () => {
      const store = useAppStore;
      const id = store.getState().addTerminalTab({ owner: SESSION_OWNER, cwd: '/cwd' });
      const tabs = store.getState().terminalTabs[SESSION_ID] ?? [];
      expect(tabs).toHaveLength(1);
      expect(tabs[0]?.id).toBe(id);
      expect(tabs[0]?.status).toBe('running');
      expect(store.getState().activeTerminalTab[SESSION_ID]).toBe(id);
    });

    it('a second addTerminalTab allocates a distinct id and becomes active', async () => {
      const store = useAppStore;
      const first = store.getState().addTerminalTab({ owner: SESSION_OWNER, cwd: null });
      const second = store.getState().addTerminalTab({ owner: SESSION_OWNER, cwd: null });
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

      const id = store.getState().addTerminalTab({ owner: SESSION_OWNER, cwd: '/worktrees/api' });

      const tab = (store.getState().terminalTabs[SESSION_ID] ?? []).find(
        (candidate) => candidate.id === id,
      );
      expect(tab?.projectId).toBe('api');
      expect(tab?.mountId).toBe('mount-api');
    });

    it('addTerminalTab leaves the project undefined when the session has no active project', async () => {
      const store = useAppStore;
      const id = store.getState().addTerminalTab({ owner: SESSION_OWNER, cwd: null });
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
      const first = store.getState().addTerminalTab({ owner: SESSION_OWNER, cwd: null });
      store.getState().addTerminalTab({ owner: SESSION_OWNER, cwd: null });
      store.getState().setActiveTerminalTab({ owner: SESSION_OWNER, tabId: first });
      expect(store.getState().activeTerminalTab[SESSION_ID]).toBe(first);
    });

    it('setTerminalTabStatus updates the tab status', async () => {
      const store = useAppStore;
      const id = store.getState().addTerminalTab({ owner: SESSION_OWNER, cwd: null });
      store.getState().setTerminalTabStatus({ owner: SESSION_OWNER, tabId: id, status: 'exited' });
      const tabs = store.getState().terminalTabs[SESSION_ID] ?? [];
      expect(tabs[0]?.status).toBe('exited');
    });

    it('closeTerminalTab removes the tab and reassigns active', async () => {
      const store = useAppStore;
      const first = store.getState().addTerminalTab({ owner: SESSION_OWNER, cwd: null });
      const second = store.getState().addTerminalTab({ owner: SESSION_OWNER, cwd: null });
      store.getState().closeTerminalTab({ owner: SESSION_OWNER, tabId: second });
      const tabs = store.getState().terminalTabs[SESSION_ID] ?? [];
      expect(tabs).toHaveLength(1);
      expect(tabs[0]?.id).toBe(first);
      expect(store.getState().activeTerminalTab[SESSION_ID]).toBe(first);
    });

    it('closes a tab when its shell exits, even with no studio open', async () => {
      const store = useAppStore;
      await store.getState().reattachTerminalTabs();
      const first = store.getState().addTerminalTab({ owner: SESSION_OWNER, cwd: null });
      const second = store.getState().addTerminalTab({ owner: SESSION_OWNER, cwd: null });

      emitTerminalExit({ terminalId: second, exitCode: 0 });

      const tabs = store.getState().terminalTabs[SESSION_ID] ?? [];
      expect(tabs.map((tab) => tab.id)).toEqual([first]);
      expect(store.getState().activeTerminalTab[SESSION_ID]).toBe(first);
    });

    it('closes a tab on a non-zero exit and ignores an unknown terminal', async () => {
      const store = useAppStore;
      await store.getState().reattachTerminalTabs();
      const only = store.getState().addTerminalTab({ owner: WORKSPACE_OWNER, cwd: null });

      emitTerminalExit({ terminalId: 'ws:missing::t9', exitCode: 1 });
      expect(store.getState().terminalTabs[`ws:${WS_ID}`]).toHaveLength(1);

      emitTerminalExit({ terminalId: only, exitCode: 130 });
      expect(store.getState().terminalTabs[`ws:${WS_ID}`] ?? []).toEqual([]);
    });

    it('moves an open terminal studio to the neighbour of the tab that exited', async () => {
      const store = useAppStore;
      await store.getState().reattachTerminalTabs();
      const first = store.getState().addTerminalTab({ owner: SESSION_OWNER, cwd: null });
      const second = store.getState().addTerminalTab({ owner: SESSION_OWNER, cwd: null });
      store
        .getState()
        .openStudio({ studio: { kind: 'terminal', terminalId: second, sessionId: SESSION_ID } });

      emitTerminalExit({ terminalId: second, exitCode: 0 });

      expect(store.getState().appStudio).toEqual({
        kind: 'terminal',
        terminalId: first,
        sessionId: SESSION_ID,
      });
    });

    it('names a new terminal after the last folder of its cwd, never Terminal N', async () => {
      const store = useAppStore;
      const first = store
        .getState()
        .addTerminalTab({ owner: SESSION_OWNER, cwd: '/mock/harborline/payments-api' });
      const second = store
        .getState()
        .addTerminalTab({ owner: SESSION_OWNER, cwd: '/mock/harborline/ledger-core/' });
      const third = store.getState().addTerminalTab({ owner: SESSION_OWNER, cwd: null });

      const titles = (store.getState().terminalTabs[SESSION_ID] ?? []).map((tab) => tab.title);

      expect(titles).toEqual(['payments-api', 'ledger-core', 'shell']);
      expect([first, second, third]).toEqual([
        `${SESSION_ID}::t1`,
        `${SESSION_ID}::t2`,
        `${SESSION_ID}::t3`,
      ]);
    });

    it('addTerminalTab files a workspace terminal under its own owner with a ws id', async () => {
      const store = useAppStore;
      const id = store
        .getState()
        .addTerminalTab({ owner: WORKSPACE_OWNER, cwd: '/mock/harborline' });

      expect(id).toBe(`ws:${WS_ID}::t1`);
      expect(store.getState().terminalTabs[`ws:${WS_ID}`]?.[0]?.owner).toEqual(WORKSPACE_OWNER);
      expect(store.getState().terminalTabs[SESSION_ID]).toBeUndefined();
    });

    it('a workspace terminal, two session terminals and their names survive a reload', async () => {
      const store = useAppStore;
      const workspaceTab = store
        .getState()
        .addTerminalTab({ owner: WORKSPACE_OWNER, cwd: '/mock/harborline' });
      const firstTab = store
        .getState()
        .addTerminalTab({ owner: SESSION_OWNER, cwd: '/mock/wt/payments-api' });
      const secondTab = store
        .getState()
        .addTerminalTab({ owner: SESSION_OWNER, cwd: '/mock/wt/ledger-core' });
      await store
        .getState()
        .renameTerminalTab({ owner: SESSION_OWNER, tabId: secondTab, title: 'tests' });
      const live = [workspaceTab, firstTab, secondTab].map((id) => ({
        id,
        cwd:
          id === workspaceTab
            ? '/mock/harborline'
            : id === firstTab
              ? '/mock/wt/payments-api'
              : '/mock/wt/ledger-core',
      }));
      expect(storySpies.setSetting).toHaveBeenCalledWith(
        expect.anything(),
        'terminal.names',
        JSON.stringify({ [secondTab]: 'tests' }),
      );
      store.setState({ terminalTabs: {}, activeTerminalTab: {}, terminalNames: {} });
      storySpies.getSetting.mockResolvedValueOnce(JSON.stringify({ [secondTab]: 'tests' }));
      storySpies.invokeTerminalListLive.mockResolvedValueOnce(live);

      await store.getState().reattachTerminalTabs();

      const workspaceTabs = store.getState().terminalTabs[`ws:${WS_ID}`] ?? [];
      const sessionTabs = store.getState().terminalTabs[SESSION_ID] ?? [];
      expect(workspaceTabs.map((tab) => [tab.owner, tab.title])).toEqual([
        [WORKSPACE_OWNER, 'harborline'],
      ]);
      expect(sessionTabs.map((tab) => [tab.owner, tab.title])).toEqual([
        [SESSION_OWNER, 'payments-api'],
        [SESSION_OWNER, 'tests'],
      ]);
    });

    it('renameTerminalTab keeps the old name and reports the error when saving fails', async () => {
      const store = useAppStore;
      const id = store
        .getState()
        .addTerminalTab({ owner: SESSION_OWNER, cwd: '/mock/wt/payments-api' });
      storySpies.setSetting.mockRejectedValueOnce(new Error('disk full'));

      await expect(
        store.getState().renameTerminalTab({ owner: SESSION_OWNER, tabId: id, title: 'api' }),
      ).rejects.toThrow('disk full');

      expect(store.getState().terminalTabs[SESSION_ID]?.[0]?.title).toBe('payments-api');
      expect(store.getState().terminalNames[id]).toBeUndefined();
    });

    it('closing a renamed terminal drops its saved name', async () => {
      const store = useAppStore;
      const id = store
        .getState()
        .addTerminalTab({ owner: SESSION_OWNER, cwd: '/mock/wt/payments-api' });
      await store.getState().renameTerminalTab({ owner: SESSION_OWNER, tabId: id, title: 'api' });
      expect(store.getState().terminalNames[id]).toBe('api');

      store.getState().closeTerminalTab({ owner: SESSION_OWNER, tabId: id });

      expect(store.getState().terminalNames[id]).toBeUndefined();
    });

    it('setTerminalWorkspaceFolder saves the folder and the selector reads it', async () => {
      const store = useAppStore;
      await store
        .getState()
        .setTerminalWorkspaceFolder({ workspaceId: WS_ID, folder: '/mock/northwind' });

      expect(store.getState().terminalFolderOverrides[WS_ID]).toBe('/mock/northwind');
      expect(storySpies.setSetting).toHaveBeenCalledWith(
        expect.anything(),
        `terminal.workspaceFolder.${WS_ID}`,
        '/mock/northwind',
      );
    });

    it('setTerminalWorkspaceFolder leaves the old folder when saving fails', async () => {
      const store = useAppStore;
      store.setState({ terminalFolderOverrides: { [WS_ID]: '/mock/acme' } });
      storySpies.setSetting.mockRejectedValueOnce(new Error('disk full'));

      await expect(
        store
          .getState()
          .setTerminalWorkspaceFolder({ workspaceId: WS_ID, folder: '/mock/northwind' }),
      ).rejects.toThrow('disk full');

      expect(store.getState().terminalFolderOverrides[WS_ID]).toBe('/mock/acme');
    });

    it('closeSessionTerminals clears the session tabs', async () => {
      const store = useAppStore;
      store.getState().addTerminalTab({ owner: SESSION_OWNER, cwd: null });
      store.getState().addTerminalTab({ owner: SESSION_OWNER, cwd: null });
      await store.getState().closeSessionTerminals(SESSION_ID);
      expect(store.getState().terminalTabs[SESSION_ID]).toBeUndefined();
      expect(store.getState().activeTerminalTab[SESSION_ID]).toBeUndefined();
    });

    it('closeSessionTerminals settles only once every shell has been told to close', async () => {
      const store = useAppStore;
      store.getState().addTerminalTab({ owner: SESSION_OWNER, cwd: null });
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

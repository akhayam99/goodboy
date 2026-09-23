// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../storyHarness';
import { SETTING_EDITOR_BINARY } from '../../../features/settings/settings';
import { SETTING_CHANGELOG_SEEN } from '../changelog/state';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  PlanId,
  PlanWithCount,
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

  describe('boot', () => {
    it('initial state defaults to pending bootPhase and not hydrated', async () => {
      const store = useAppStore;
      expect(store.getState().bootPhase).toBe('pending');
      expect(store.getState().hydrated).toBe(false);
    });

    it('after hydrate the boot phase reaches ready (no workspaces configured)', async () => {
      const store = useAppStore;
      await store.getState().hydrate();
      const s = store.getState();
      expect(s.hydrated).toBe(true);
      expect(s.bootPhase).toBe('ready');
    });

    it('warns once, grouped across launches, when saved integration keys stay out of the keychain', async () => {
      const store = useAppStore;
      const invokeImpl = storySpies.tauriInvoke.getMockImplementation();
      storySpies.tauriInvoke.mockImplementation(async (command?: unknown, args?: unknown) => {
        if (command === 'integration_credentials_adopt') {
          throw new Error('keychain is locked');
        }
        return invokeImpl?.(command, args);
      });

      await store.getState().hydrate();

      expect(store.getState().notifications).toContainEqual(
        expect.objectContaining({
          severity: 'warning',
          title: "Couldn't move saved integration keys to the keychain",
          body: 'keychain is locked',
          coalesceKey: 'boot:integration-key-adoption',
        }),
      );
    });

    it('reattaches live scripts and terminals during hydration', async () => {
      const store = useAppStore;

      await store.getState().hydrate();

      await vi.waitFor(() => {
        expect(storySpies.tauriInvoke).toHaveBeenCalledWith('workspace_script_list_live');
        expect(storySpies.tauriInvoke).toHaveBeenCalledWith('terminal_list_live');
      });
    });

    it('reports the elapsed time of every boot breadcrumb that awaits work', async () => {
      type BreadcrumbDetailParams = { phase: string };

      const store = useAppStore;
      let clock = 0;
      const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => clock);
      storySpies.runDbMigrations.mockImplementationOnce(async () => {
        clock = 10;
      });
      storySpies.getSetting.mockImplementation(async (_db: unknown, key: string) => {
        if (key === SETTING_EDITOR_BINARY) {
          clock = 1_010;
        }
        return null;
      });
      storySpies.listProviderCredentials.mockImplementationOnce(async () => {
        clock = 1_040;
        return [];
      });
      storySpies.listWorkspaces.mockImplementationOnce(async () => {
        clock = 1_105;
        return [];
      });

      await store.getState().hydrate();
      nowSpy.mockRestore();

      const calls = storySpies.tauriInvoke.mock.calls as unknown as ReadonlyArray<
        ReadonlyArray<unknown>
      >;
      const breadcrumbDetail = ({ phase }: BreadcrumbDetailParams): unknown => {
        const call = calls.find(([command, payload]) => {
          if (command !== 'boot_breadcrumb') {
            return false;
          }
          if (typeof payload !== 'object' || payload === null) {
            return false;
          }
          if (!('phase' in payload)) {
            return false;
          }
          return payload.phase === phase;
        });
        if (call === undefined) {
          return undefined;
        }
        const payload = call[1];
        if (typeof payload !== 'object' || payload === null) {
          return undefined;
        }
        if (!('detail' in payload)) {
          return undefined;
        }
        return payload.detail;
      };

      expect(breadcrumbDetail({ phase: 'migrating' })).toBe('ms=10');
      expect(breadcrumbDetail({ phase: 'loading-settings' })).toBe('ms=1000');
      expect(breadcrumbDetail({ phase: 'detecting-cli' })).toBe('ms=30');
      expect(breadcrumbDetail({ phase: 'loading-workspaces' })).toBe('ms=65');
      expect(breadcrumbDetail({ phase: 'ready' })).toBe('ms=1105,ok');
    });

    it('joins the in-flight hydration instead of starting a second run on retry', async () => {
      const store = useAppStore;
      let releaseFirst: () => void = () => undefined;
      storySpies.listWorkspaces.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            releaseFirst = () => resolve([]);
          }),
      );

      void store.getState().hydrate();
      await vi.waitFor(() => {
        expect(storySpies.listWorkspaces).toHaveBeenCalledOnce();
      });

      const retry = store.getState().retryHydrate();
      releaseFirst();
      await retry;

      expect(storySpies.listWorkspaces).toHaveBeenCalledOnce();
      expect(storySpies.runDbMigrations).toHaveBeenCalledOnce();
      expect(store.getState().bootPhase).toBe('ready');
    });

    it('runs the database migrations once when two hydrations start concurrently', async () => {
      const store = useAppStore;

      await Promise.all([store.getState().hydrate(), store.getState().hydrate()]);

      expect(storySpies.runDbMigrations).toHaveBeenCalledOnce();
      expect(store.getState().bootPhase).toBe('ready');
    });

    it('still restarts hydration when retry runs after a failed attempt', async () => {
      const store = useAppStore;
      storySpies.listWorkspaces.mockRejectedValueOnce(new Error('boom'));

      await store.getState().hydrate();
      expect(store.getState().bootPhase).toBe('error');

      await store.getState().retryHydrate();

      expect(store.getState().bootPhase).toBe('ready');
      expect(storySpies.runDbMigrations).toHaveBeenCalledTimes(2);
    });

    it('survives a boot breadcrumb command that throws synchronously', async () => {
      const store = useAppStore;
      storySpies.tauriInvoke.mockImplementation(((command: unknown) => {
        if (command === 'boot_breadcrumb') {
          throw new Error('breadcrumb sink exploded');
        }
        return Promise.resolve(null);
      }) as never);

      await store.getState().hydrate();

      expect(store.getState().bootPhase).toBe('ready');
      expect(store.getState().error).toBeNull();
    });

    it('never leaves the breadcrumb rejection unhandled', async () => {
      const store = useAppStore;
      const unhandled = vi.fn();
      process.on('unhandledRejection', unhandled);
      storySpies.tauriInvoke.mockImplementation(((command: unknown) => {
        if (command === 'boot_breadcrumb') {
          return {
            then: (_onFulfilled: unknown, onRejected: (reason: unknown) => void) => {
              onRejected(new Error('breadcrumb sink exploded'));
            },
          };
        }
        return Promise.resolve(null);
      }) as never);

      await store.getState().hydrate();
      await new Promise((resolve) => setImmediate(resolve));
      process.off('unhandledRejection', unhandled);

      expect(unhandled).not.toHaveBeenCalled();
      expect(store.getState().bootPhase).toBe('ready');
    });

    it('loads notifications at boot without waiting for the bell to mount', async () => {
      const store = useAppStore;
      await store.getState().hydrate();
      expect(storySpies.listNotifications).toHaveBeenCalled();
    });

    it('hydrates the changelog seen marker before the boot phase reaches ready', async () => {
      const store = useAppStore;
      let bootPhaseAtCall: string | null = null;
      storySpies.getSetting.mockImplementation(async (_db: unknown, key: string) => {
        if (key === SETTING_CHANGELOG_SEEN) {
          bootPhaseAtCall = store.getState().bootPhase;
        }
        return null;
      });

      await store.getState().hydrate();

      expect(bootPhaseAtCall).not.toBeNull();
      expect(bootPhaseAtCall).not.toBe('ready');
    });

    it('applies the qa deciding preview named by the environment at boot', async () => {
      const store = useAppStore;
      store.setState({ orchestratingWorkflowRuns: {} } as never);
      storySpies.tauriInvoke.mockImplementation(async (command: unknown) => {
        if (command === 'qa_deciding_workflow_runs') {
          return ['run-qa-preview'];
        }
        return null;
      });

      await store.getState().hydrate();

      expect(store.getState().orchestratingWorkflowRuns).toEqual({ 'run-qa-preview': true });
    });

    it('offers to clean the session folders left behind on disk', async () => {
      const store = useAppStore;
      storySpies.listWorkspaces.mockResolvedValueOnce([
        {
          id: 'ws-1' as WorkspaceId,
          name: 'demo',
          slug: 'demo',
          sessionsRoot: '/repo',
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
          createdAt: '2026-01-01T00:00:00.000Z' as IsoDateTime,
          updatedAt: '2026-01-01T00:00:00.000Z' as IsoDateTime,
        },
      ]);
      storySpies.listProjectsForWorkspace.mockResolvedValueOnce([
        {
          id: 'project-1' as ProjectId,
          workspaceId: 'ws-1' as WorkspaceId,
          name: 'demo',
          rootPath: '/repo',
          kind: 'repo',
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
          createdAt: '2026-01-01T00:00:00.000Z' as IsoDateTime,
          updatedAt: '2026-01-01T00:00:00.000Z' as IsoDateTime,
        },
      ]);
      storySpies.scanOrphanWorktrees.mockResolvedValueOnce([
        {
          path: '/repo/.goodboy/worktrees/gb-ghost',
          name: 'gb-ghost',
          sizeBytes: 2048,
          isRegistered: false,
        },
      ]);

      await store.getState().hydrate();

      await vi.waitFor(() => {
        expect(store.getState().orphanWorktrees['ws-1']).toHaveLength(1);
      });
      expect(storySpies.insertNotification).toHaveBeenCalled();
    });
  });
});

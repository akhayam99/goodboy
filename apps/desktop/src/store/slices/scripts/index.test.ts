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
  MountId,
  PlanWithCount,
  Project,
  ProjectId,
  ProviderRunId,
  Session,
  SessionId,
  SessionProjectMount,
  Workspace,
  WorkspaceId,
  ProjectScript,
  ProjectScriptId,
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
vi.mock('../../../features/scripts/scripts', async () => ({
  ...(await import('../../storyHarness')).scriptsModuleMock(),
  listenScriptExit: listenScriptExitSpy,
}));
vi.mock('../../../features/terminal/terminal', async () =>
  (await import('../../storyHarness')).terminalModuleMock(),
);
vi.mock('../../../features/context/components/QuestionsTab/useOpenQuestions', async () =>
  (await import('../../storyHarness')).openQuestionsModuleMock(),
);
vi.mock('../../../features/settings/config-export', async () =>
  (await import('../../storyHarness')).configExportModuleMock(),
);

let scriptExitHandler: ((payload: { runId: string; exitCode: number }) => void) | null = null;
const listenScriptExitSpy = vi.fn(
  async (handler: (payload: { runId: string; exitCode: number }) => void) => {
    scriptExitHandler = handler;
    return () => undefined;
  },
);

const WS_ID = 'workspace-1' as WorkspaceId;
const WS_ID_2 = 'workspace-2' as WorkspaceId;
const PROJECT_ID = 'project-1' as ProjectId;
const PROJECT_ID_2 = 'project-2' as ProjectId;
const SESSION_ID = 'session-1' as SessionId;
const SESSION_ID_2 = 'session-2' as SessionId;
const AGENT_ID = 'agent-1' as AgentId;
const AGENT_ID_2 = 'agent-2' as AgentId;
const RUN_ID = 'run-1' as ProviderRunId;
const PLAN_ID = 'plan-1' as PlanId;
const NOW = '2026-05-28T00:00:00.000Z' as IsoDateTime;

const FIRST_MOUNT_ID = 'mount-api-one' as MountId;
const SECOND_MOUNT_ID = 'mount-api-two' as MountId;

const TWO_API_MOUNTS: ReadonlyArray<SessionProjectMount> = [
  {
    mountId: FIRST_MOUNT_ID,
    projectId: PROJECT_ID,
    mountName: 'api',
    worktreePath: '/sessions/one/api-one',
    repoRoot: '/repos/api',
    branch: 'ak/one',
    sessionId: SESSION_ID,
    lastWorktreePath: null,
    baseBranch: null,
    parallelIndex: 0,
    isAttached: true,
    diskState: 'present',
    revision: 0,
  },
  {
    mountId: SECOND_MOUNT_ID,
    projectId: PROJECT_ID,
    mountName: 'api split',
    worktreePath: '/sessions/one/api-two',
    repoRoot: '/repos/api',
    branch: 'ak/two',
    sessionId: SESSION_ID,
    lastWorktreePath: null,
    baseBranch: null,
    parallelIndex: 0,
    isAttached: true,
    diskState: 'present',
    revision: 0,
  },
];

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

const buildProject = (overrides: Partial<Project> = {}): Project => ({
  id: PROJECT_ID,
  workspaceId: WS_ID,
  name: 'repo',
  rootPath: '/tmp/repo',
  kind: 'repo',
  overrides: buildWorkspace().overrides,
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides,
});

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
    useAppStore.setState({
      projects: [buildProject(), buildProject({ id: PROJECT_ID_2, name: 'web' })],
    });
    scriptExitHandler = null;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('scripts', () => {
    it('loads discovered scripts once and refreshes them on demand', async () => {
      const store = useAppStore;
      const group = {
        source: 'package-json' as const,
        packageName: 'desktop',
        relDir: '',
        manager: 'pnpm',
        scripts: [{ name: 'dev', command: 'pnpm run dev' }],
      };
      storySpies.scanProjectScripts.mockResolvedValue([group]);

      await store
        .getState()
        .loadDiscoveredScripts({ sessionId: SESSION_ID, worktreePath: '/sessions/one/api' });
      await store
        .getState()
        .loadDiscoveredScripts({ sessionId: SESSION_ID, worktreePath: '/sessions/one/api' });
      await store
        .getState()
        .refreshDiscoveredScripts({ sessionId: SESSION_ID, worktreePath: '/sessions/one/api' });

      expect(storySpies.scanProjectScripts).toHaveBeenCalledTimes(2);
      expect(store.getState().discoveredScripts[SESSION_ID]?.['/sessions/one/api']).toEqual([
        group,
      ]);
      expect(store.getState().discoveredScriptScans[SESSION_ID]?.['/sessions/one/api']).toEqual({
        status: 'ready',
        error: null,
      });
    });

    it('runs a discovered script through the ad hoc bridge and shared listeners', async () => {
      const store = useAppStore;
      const resultPromise = store.getState().runDiscoveredScript({
        sessionId: SESSION_ID,
        scriptId: 'manifest-script',
        name: 'dev',
        command: 'pnpm run dev',
        cwd: '/sessions/one/api/apps/web',
      });
      await vi.waitFor(() => expect(storySpies.runAdhocScript).toHaveBeenCalledOnce());
      const invocation = storySpies.runAdhocScript.mock.calls[0]?.[0];
      if (invocation?.runId === undefined || scriptExitHandler === null) {
        throw new Error('discovered script listeners were not ready');
      }
      scriptExitHandler({ runId: invocation.runId, exitCode: 0 });
      await resultPromise;

      expect(invocation).toEqual(
        expect.objectContaining({
          scriptId: 'manifest-script',
          name: 'dev',
          body: 'pnpm run dev',
          sessionId: SESSION_ID,
          cwd: '/sessions/one/api/apps/web',
        }),
      );
      expect(store.getState().scriptRuns[SESSION_ID]?.['manifest-script']?.status).toBe('ok');
    });

    it('loadScripts caches workspace scripts', async () => {
      const store = useAppStore;
      const script: ProjectScript = {
        id: 'sc-1' as ProjectScriptId,
        projectId: PROJECT_ID,
        name: 'test',
        body: 'echo',
        sortOrder: 0,
        createdAt: NOW,
        updatedAt: NOW,
      };
      storySpies.listProjectScripts.mockResolvedValueOnce([script]);
      await store.getState().loadScripts(WS_ID);
      expect(store.getState().projectScripts[WS_ID]).toEqual([script]);
    });

    it('deleteScript removes from cache immediately', async () => {
      const store = useAppStore;
      const script: ProjectScript = {
        id: 'sc-1' as ProjectScriptId,
        projectId: PROJECT_ID,
        name: 'test',
        body: 'echo',
        sortOrder: 0,
        createdAt: NOW,
        updatedAt: NOW,
      };
      store.setState({ projectScripts: { [WS_ID]: [script] } });
      await store.getState().deleteScript(script.id, WS_ID);
      expect(store.getState().projectScripts[WS_ID]).toEqual([]);
    });

    it('saveScript persists the required project id for a new script', async () => {
      const store = useAppStore;

      await store.getState().saveScript({
        workspaceId: WS_ID,
        projectId: PROJECT_ID_2,
        name: 'web setup',
        body: 'echo web',
      });

      expect(storySpies.upsertProjectScript).toHaveBeenCalledWith(
        expect.objectContaining({
          script: expect.objectContaining({ projectId: PROJECT_ID_2 }),
        }),
      );
    });

    it('saveScript refuses a project that belongs to another workspace', async () => {
      const store = useAppStore;
      store.setState({
        projects: [
          buildProject(),
          buildProject({ id: PROJECT_ID_2, workspaceId: 'ws-other' as WorkspaceId }),
        ],
      } as never);

      await expect(
        store
          .getState()
          .saveScript({ workspaceId: WS_ID, projectId: PROJECT_ID_2, name: 'x', body: 'echo' }),
      ).rejects.toThrow(/does not belong/);
      expect(storySpies.upsertProjectScript).not.toHaveBeenCalled();
    });

    it('saveScript reassigns an existing script to the given project', async () => {
      const store = useAppStore;
      const script: ProjectScript = {
        id: 'sc-1' as ProjectScriptId,
        projectId: PROJECT_ID,
        name: 'setup',
        body: 'echo api',
        sortOrder: 0,
        createdAt: NOW,
        updatedAt: NOW,
      };
      store.setState({ projectScripts: { [WS_ID]: [script] } });

      await store.getState().saveScript({
        workspaceId: WS_ID,
        projectId: PROJECT_ID_2,
        id: script.id,
        name: script.name,
        body: script.body,
      });

      expect(storySpies.upsertProjectScript).toHaveBeenCalledWith(
        expect.objectContaining({
          script: expect.objectContaining({ id: script.id, projectId: PROJECT_ID_2 }),
        }),
      );
    });

    it("runScript invokes the script in its project's session mount", async () => {
      const store = useAppStore;
      const script: ProjectScript = {
        id: 'sc-1' as ProjectScriptId,
        projectId: PROJECT_ID_2,
        name: 'web setup',
        body: 'echo web',
        sortOrder: 0,
        createdAt: NOW,
        updatedAt: NOW,
      };
      const mounts: ReadonlyArray<SessionProjectMount> = [
        {
          projectId: PROJECT_ID,
          mountName: 'api',
          worktreePath: '/sessions/one/api',
          repoRoot: '/repos/api',
          branch: 'ak/one',
          mountId: 'mount-fixture-2' as MountId,
          sessionId: SESSION_ID,
          lastWorktreePath: null,
          baseBranch: null,
          parallelIndex: 0,
          isAttached: true,
          diskState: 'present',
          revision: 0,
        },
        {
          projectId: PROJECT_ID_2,
          mountName: 'web',
          worktreePath: '/sessions/one/web',
          repoRoot: '/repos/web',
          branch: 'ak/one',
          mountId: 'mount-fixture-1' as MountId,
          sessionId: SESSION_ID,
          lastWorktreePath: null,
          baseBranch: null,
          parallelIndex: 0,
          isAttached: true,
          diskState: 'present',
          revision: 0,
        },
      ];
      store.setState({
        sessions: [buildSession({ activeProjectId: PROJECT_ID })],
        sessionProjectMounts: { [SESSION_ID]: mounts },
        projectScripts: { [WS_ID]: [script] },
      });

      const resultPromise = store
        .getState()
        .runScript({ sessionId: SESSION_ID, scriptId: script.id });
      await vi.waitFor(() => expect(storySpies.invokeScriptRun).toHaveBeenCalledOnce());
      const invocation = storySpies.invokeScriptRun.mock.calls[0]?.[0];
      const runId = invocation?.runId;
      if (runId === undefined || scriptExitHandler === null) {
        throw new Error('script listeners were not ready');
      }
      scriptExitHandler({ runId, exitCode: 0 });
      await resultPromise;

      expect(invocation?.cwd).toBe('/sessions/one/web');
    });

    it('runScript refuses to guess between two mounts of the same project', async () => {
      const store = useAppStore;
      const script: ProjectScript = {
        id: 'sc-1' as ProjectScriptId,
        projectId: PROJECT_ID,
        name: 'setup',
        body: 'echo api',
        sortOrder: 0,
        createdAt: NOW,
        updatedAt: NOW,
      };
      store.setState({
        sessions: [buildSession({ activeProjectId: PROJECT_ID })],
        sessionActiveMount: {},
        sessionProjectMounts: { [SESSION_ID]: TWO_API_MOUNTS },
        projectScripts: { [WS_ID]: [script] },
      });

      const result = await store
        .getState()
        .runScript({ sessionId: SESSION_ID, scriptId: script.id });

      expect(storySpies.invokeScriptRun).not.toHaveBeenCalled();
      expect(result.stderr).toContain('several mounts');
    });

    it('runScript uses the mount the caller named', async () => {
      const store = useAppStore;
      const script: ProjectScript = {
        id: 'sc-1' as ProjectScriptId,
        projectId: PROJECT_ID,
        name: 'setup',
        body: 'echo api',
        sortOrder: 0,
        createdAt: NOW,
        updatedAt: NOW,
      };
      store.setState({
        sessions: [buildSession({ activeProjectId: PROJECT_ID })],
        sessionActiveMount: {},
        sessionProjectMounts: { [SESSION_ID]: TWO_API_MOUNTS },
        projectScripts: { [WS_ID]: [script] },
      });

      const resultPromise = store
        .getState()
        .runScript({ sessionId: SESSION_ID, scriptId: script.id, mountId: SECOND_MOUNT_ID });
      await vi.waitFor(() => expect(storySpies.invokeScriptRun).toHaveBeenCalledOnce());
      const invocation = storySpies.invokeScriptRun.mock.calls[0]?.[0];
      const runId = invocation?.runId;
      if (runId === undefined || scriptExitHandler === null) {
        throw new Error('script listeners were not ready');
      }
      scriptExitHandler({ runId, exitCode: 0 });
      await resultPromise;

      expect(invocation?.cwd).toBe('/sessions/one/api-two');
    });

    it('runScript records an error and refuses to invoke when the project is unmounted', async () => {
      const store = useAppStore;
      const script: ProjectScript = {
        id: 'sc-1' as ProjectScriptId,
        projectId: PROJECT_ID,
        name: 'setup',
        body: 'echo api',
        sortOrder: 0,
        createdAt: NOW,
        updatedAt: NOW,
      };
      store.setState({
        sessions: [buildSession()],
        sessionProjectMounts: { [SESSION_ID]: [] },
        projectScripts: { [WS_ID]: [script] },
      });

      const result = await store
        .getState()
        .runScript({ sessionId: SESSION_ID, scriptId: script.id });

      expect(storySpies.invokeScriptRun).not.toHaveBeenCalled();
      expect(store.getState().scriptRuns[SESSION_ID]?.[script.id]?.status).toBe('error');
      expect(result.stderr).toBe('repo is not mounted in this session');
    });

    it('reattaches a live script run and completes it from the recovered exit listener', async () => {
      const store = useAppStore;
      const scriptId = 'sc-live' as ProjectScriptId;
      storySpies.invokeScriptListLive.mockResolvedValueOnce([
        { runId: 'run-live', scriptId, sessionId: SESSION_ID, startedAt: 1234 },
      ]);

      await store.getState().reattachScriptRuns();

      expect(store.getState().scriptRuns[SESSION_ID]?.[scriptId]).toEqual({
        status: 'pending',
        result: null,
        runId: 'run-live',
        startedAt: 1234,
      });
      if (scriptExitHandler === null) {
        throw new Error('script exit listener was not restored');
      }
      scriptExitHandler({ runId: 'run-live', exitCode: 0 });
      expect(store.getState().scriptRuns[SESSION_ID]?.[scriptId]?.status).toBe('ok');
    });
  });
});

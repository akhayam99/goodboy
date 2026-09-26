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
  Message,
  MessageId,
  MountId,
  PlanId,
  PlanWithCount,
  Project,
  ProviderRunId,
  ProjectId,
  Session,
  SessionExternalTask,
  SessionId,
  Workspace,
  WorkspaceId,
} from '@goodboy/types';
import { materializationSeedFor } from './materializationSeeds';

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
const PROJECT_ID = 'project-1' as ProjectId;
const SESSION_ID = 'session-1' as SessionId;
const SESSION_ID_2 = 'session-2' as SessionId;
const AGENT_ID = 'agent-1' as AgentId;
const AGENT_ID_2 = 'agent-2' as AgentId;
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
    storySpies.getWorkspaceById.mockResolvedValue(buildWorkspace());
    storySpies.listProjectsForWorkspace.mockResolvedValue([buildProject()]);
    storySpies.createWorktree.mockResolvedValue({
      worktreePath: '/tmp/repo/.goodboy/worktrees/session',
      branchName: 'goodboy/session',
      slug: 'session',
      reused: false,
    });
    storySpies.createSessionDir.mockResolvedValue({
      worktreePath: '/tmp/repo/sessions/session',
      branchName: '',
      slug: 'session',
      reused: false,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('sessions', () => {
    it('loads durable resolve rows when agents are already cached', async () => {
      const store = useAppStore;
      const original = store.getState().loadResolveSession;
      const loadResolveSession = vi.fn(async () => undefined);
      store.setState({ sessionPhaseRuns: { [SESSION_ID]: [] }, loadResolveSession });
      try {
        await store.getState().setCurrentSession(SESSION_ID);
        expect(loadResolveSession).toHaveBeenCalledWith({ sessionId: SESSION_ID });
      } finally {
        store.setState({ loadResolveSession: original });
      }
    });

    it('setCurrentSession reads the context slots the database holds', async () => {
      const store = useAppStore;
      const db = await import('@goodboy/db');
      (db.listContextSlotsForSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
        { key: 'last_output_summary', value: '#### State\n- shipped', enabled: true },
        { key: 'decisions', value: '- use tailwind', enabled: true },
      ]);

      await store.getState().setCurrentSession(SESSION_ID);

      await vi.waitFor(() => {
        expect(store.getState().sessionSlotsLoad[SESSION_ID]).toBe('loaded');
      });
      expect(store.getState().sessionSlots[SESSION_ID]).toHaveLength(2);
    });

    it('opens a session whose id another path already made current, so its context still loads', async () => {
      const store = useAppStore;
      const db = await import('@goodboy/db');
      (db.listContextSlotsForSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
        { key: 'last_output_summary', value: '#### State\n- shipped', enabled: true },
      ]);
      store.setState({
        sessions: [buildSession({ id: SESSION_ID })],
        currentWorkspaceId: WS_ID,
        currentSessionId: SESSION_ID,
      });

      await store.getState().setCurrentSession(SESSION_ID);

      expect(store.getState().sessionSlots[SESSION_ID]).toHaveLength(1);
      expect(store.getState().sessionSlotsLoad[SESSION_ID]).toBe('loaded');
    });

    it('reads the database for a session whose slots were only ever written in memory', async () => {
      const store = useAppStore;
      const db = await import('@goodboy/db');
      (db.listContextSlotsForSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
        { key: 'goal', value: 'ship it', enabled: true },
        { key: 'last_output_summary', value: '#### State\n- shipped', enabled: true },
      ]);
      store.setState({
        sessionSlots: { [SESSION_ID]: [{ key: 'goal', value: 'ship it', enabled: true }] },
      });

      await store.getState().setCurrentSession(SESSION_ID);

      await vi.waitFor(() => {
        expect(store.getState().sessionSlots[SESSION_ID]).toHaveLength(2);
      });
    });

    it('setCurrentSession restores the effort each finished run was started with', async () => {
      const store = useAppStore;
      const runId = 'run-1' as ProviderRunId;
      storySpies.invokeAgentList.mockResolvedValue([
        buildAgent({ id: AGENT_ID, status: 'completed' }),
      ]);
      const db = await import('@goodboy/db');
      (db.listAgentTurnSpanRoutes as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        {
          runId,
          agentId: AGENT_ID,
          provider: 'anthropic',
          model: 'claude-sonnet-5',
          effort: 'medium',
        },
      ]);

      await store.getState().setCurrentSession(SESSION_ID);

      await vi.waitFor(() => {
        expect(store.getState().runRouting[AGENT_ID]?.[runId]).toEqual({
          provider: 'anthropic',
          model: 'claude-sonnet-5',
          effort: 'medium',
        });
      });
    });

    it('setCurrentSession rebuilds resolver verdicts from the persisted transcript', async () => {
      const store = useAppStore;
      storySpies.invokeAgentList.mockResolvedValue([
        buildAgent({
          id: AGENT_ID,
          name: 'resolver',
          kind: 'resolver',
          status: 'completed',
          sourceThreadIds: ['PRRT_1'],
        }),
      ]);
      const { listMessagesForAgent } = await import('@goodboy/db');
      (listMessagesForAgent as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: 'message-1' as MessageId,
          sessionId: SESSION_ID,
          agentId: AGENT_ID,
          role: 'assistant',
          content: '<<comment-resolved threadId="PRRT_1" commitSha="abcdef1234567890">>',
          createdAt: NOW,
        } satisfies Message,
      ]);

      await store.getState().setCurrentSession(SESSION_ID);

      await vi.waitFor(() => {
        expect(
          (store.getState().sessionResolveThreads[SESSION_ID] ?? []).map((row) => ({
            threadId: row.threadId,
            state: row.state,
            commitShas: row.commitShas,
          })),
        ).toEqual([{ threadId: 'PRRT_1', state: 'fixed', commitShas: ['abcdef1234567890'] }]);
      });
    });

    it('renameTask updates goal and stamps titleUserEdited', async () => {
      const store = useAppStore;
      store.setState({ sessions: [buildSession()] });
      await store.getState().renameTask(SESSION_ID, '  fresh name  ');
      const s = store.getState().sessions.find((x) => x.id === SESSION_ID);
      expect(s?.goal).toBe('fresh name');
      expect(s?.titleUserEdited).toBe(true);
    });

    it('renameTask rejects empty names', async () => {
      const store = useAppStore;
      store.setState({ sessions: [buildSession()] });
      await expect(store.getState().renameTask(SESSION_ID, '   ')).rejects.toThrow();
    });

    it('setSessionPermissionMode mutates the session row', async () => {
      const store = useAppStore;
      store.setState({ sessions: [buildSession()] });
      await store.getState().setSessionPermissionMode(SESSION_ID, 'default');
      expect(store.getState().sessions[0]?.permissionMode).toBe('default');
    });

    it('archiveTask keeps currentSessionId and session state when archiving the current session', async () => {
      const store = useAppStore;
      store.setState({
        sessions: [buildSession()],
        currentSessionId: SESSION_ID,
        sessionProjectPrs: { [SESSION_ID]: {} },
        sessionSelectedPrNumber: { [SESSION_ID]: 40 },
      });
      await store.getState().archiveTask(SESSION_ID);
      const s = store.getState();
      expect(s.sessions).toEqual([]);
      expect(s.currentSessionId).toBe(SESSION_ID);
      expect(s.archivedSessions[WS_ID]?.map((x) => x.id)).toEqual([SESSION_ID]);
      expect(s.archivedSessions[WS_ID]?.[0]?.archivedAt).toBeDefined();
      expect(s.sessionProjectPrs[SESSION_ID]).toBeDefined();
      expect(s.sessionSelectedPrNumber[SESSION_ID]).toBe(40);
    });

    it('archiveTask removes a non-current session and wipes its state without touching currentSessionId', async () => {
      const store = useAppStore;
      store.setState({
        sessions: [buildSession(), buildSession({ id: SESSION_ID_2, goal: 'two' })],
        currentSessionId: SESSION_ID,
        sessionProjectPrs: { [SESSION_ID_2]: {} },
        sessionSelectedPrNumber: { [SESSION_ID_2]: 40 },
        sessionTelemetry: { [SESSION_ID_2]: [] },
      });
      await store.getState().archiveTask(SESSION_ID_2);
      const s = store.getState();
      expect(s.sessions.map((x) => x.id)).toEqual([SESSION_ID]);
      expect(s.currentSessionId).toBe(SESSION_ID);
      expect(s.archivedSessions[WS_ID]?.map((x) => x.id)).toEqual([SESSION_ID_2]);
      expect(s.sessionProjectPrs[SESSION_ID_2]).toBeUndefined();
      expect(s.sessionSelectedPrNumber[SESSION_ID_2]).toBeUndefined();
      expect(s.sessionTelemetry[SESSION_ID_2]).toBeUndefined();
    });

    it('unarchiveTask restores a session from archived cache to active when in same workspace', async () => {
      const store = useAppStore;
      const archived: Session = {
        ...buildSession(),
        archivedAt: NOW,
      } as Session;
      store.setState({
        workspaces: [buildWorkspace()],
        currentWorkspaceId: WS_ID,
        archivedSessions: { [WS_ID]: [archived] },
      });
      await store.getState().unarchiveTask(SESSION_ID);
      const s = store.getState();
      expect(s.sessions.find((x) => x.id === SESSION_ID)).toBeDefined();
      expect(s.archivedSessions[WS_ID]).toEqual([]);
    });

    it('unarchiveTask reloads the workflows attached to the session', async () => {
      const store = useAppStore;
      const archived: Session = {
        ...buildSession(),
        archivedAt: NOW,
      } as Session;
      const workflow = { id: 'wf-1', name: 'release' };
      storySpies.invokeWorkflowsForSession.mockResolvedValueOnce([workflow]);
      store.setState({
        workspaces: [buildWorkspace()],
        currentWorkspaceId: WS_ID,
        archivedSessions: { [WS_ID]: [archived] },
      });
      await store.getState().unarchiveTask(SESSION_ID);
      const s = store.getState();
      expect(storySpies.invokeWorkflowsForSession).toHaveBeenCalledWith(SESSION_ID);
      expect(s.sessionWorkflows[SESSION_ID]).toEqual([workflow]);
    });

    it('unarchiveTask hides a mount whose folder is gone and clears its path', async () => {
      const store = useAppStore;
      const db = await import('@goodboy/db');
      const archived: Session = { ...buildSession(), archivedAt: NOW } as Session;
      vi.mocked(db.listWorktreesForSession).mockResolvedValueOnce([
        {
          id: 'mount-gone',
          sessionId: SESSION_ID,
          projectId: PROJECT_ID,
          worktreePath: '/tmp/repo/.goodboy/worktrees/gone',
          branch: 'ak/gone',
          parallelIndex: 1,
          mountName: 'repo',
          createdAt: Date.now(),
        },
      ] as never);
      vi.mocked(db.getSessionMount).mockResolvedValueOnce({ revision: 7 } as never);
      storySpies.inspectWorktree.mockResolvedValueOnce({
        kind: 'missing',
        path: '/tmp/repo/.goodboy/worktrees/gone',
      } as never);
      store.setState({
        workspaces: [buildWorkspace()],
        projects: [buildProject()],
        currentWorkspaceId: WS_ID,
        archivedSessions: { [WS_ID]: [archived] },
      });

      await store.getState().unarchiveTask(SESSION_ID);

      expect(store.getState().sessionProjectMounts[SESSION_ID]).toEqual([]);
      expect(storySpies.updateSessionMountLifecycle).toHaveBeenCalledWith(
        expect.objectContaining({
          mountId: 'mount-gone',
          worktreePath: null,
          diskState: 'missing',
          expectedRevision: 7,
        }),
      );
    });

    it('unarchiveTask realigns a session whose project disagrees with its mount', async () => {
      const store = useAppStore;
      const db = await import('@goodboy/db');
      const otherProjectId = 'project-stale' as ProjectId;
      const archived: Session = {
        ...buildSession(),
        activeMountId: 'mount-live' as MountId,
        activeProjectId: otherProjectId,
        archivedAt: NOW,
      } as Session;
      vi.mocked(db.listWorktreesForSession).mockResolvedValueOnce([
        {
          id: 'mount-live',
          sessionId: SESSION_ID,
          projectId: PROJECT_ID,
          worktreePath: '/tmp/repo/.goodboy/worktrees/live',
          branch: 'ak/live',
          parallelIndex: 1,
          mountName: 'repo',
          revision: 2,
          createdAt: Date.now(),
        },
      ] as never);
      store.setState({
        workspaces: [buildWorkspace()],
        projects: [buildProject()],
        currentWorkspaceId: WS_ID,
        archivedSessions: { [WS_ID]: [archived] },
      });

      await store.getState().unarchiveTask(SESSION_ID);

      expect(vi.mocked(db.updateSessionWriteDestination)).toHaveBeenCalledWith({
        db: expect.anything(),
        sessionId: SESSION_ID,
        mountId: 'mount-live',
      });
      const restored = store.getState().sessions.find((candidate) => candidate.id === SESSION_ID);
      expect(restored?.activeProjectId).toBe(PROJECT_ID);
      expect(restored?.activeMountId).toBe('mount-live');
      expect(store.getState().sessionActiveProject[SESSION_ID]).toBe(PROJECT_ID);
    });

    it('unarchiveTask carries the stored revision into the seeded project mount', async () => {
      const store = useAppStore;
      const db = await import('@goodboy/db');
      const archived: Session = { ...buildSession(), archivedAt: NOW } as Session;
      vi.mocked(db.listWorktreesForSession).mockResolvedValueOnce([
        {
          id: 'mount-live',
          sessionId: SESSION_ID,
          projectId: PROJECT_ID,
          worktreePath: '/tmp/repo/.goodboy/worktrees/live',
          branch: 'ak/live',
          parallelIndex: 0,
          mountName: 'repo',
          revision: 5,
          createdAt: Date.now(),
        },
      ] as never);
      store.setState({
        workspaces: [buildWorkspace()],
        projects: [buildProject()],
        currentWorkspaceId: WS_ID,
        archivedSessions: { [WS_ID]: [archived] },
      });

      await store.getState().unarchiveTask(SESSION_ID);

      expect(store.getState().sessionProjectMounts[SESSION_ID]?.[0]?.revision).toBe(5);
    });

    it('unarchiveTask restores the session and reports when the secondary refresh fails', async () => {
      const store = useAppStore;
      const archived: Session = { ...buildSession(), archivedAt: NOW } as Session;
      storySpies.invokeAgentList.mockRejectedValueOnce(new Error('agent list unavailable'));
      store.setState({
        workspaces: [buildWorkspace()],
        currentWorkspaceId: WS_ID,
        archivedSessions: { [WS_ID]: [archived] },
      });

      await store.getState().unarchiveTask(SESSION_ID);

      const s = store.getState();
      expect(s.sessions.find((x) => x.id === SESSION_ID)).toBeDefined();
      expect(s.archivedSessions[WS_ID]).toEqual([]);
      expect(storySpies.insertNotification).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          kind: 'error',
          severity: 'warning',
          sessionId: SESSION_ID,
        }),
      );
    });

    it('writes the archive and the restore to the session timeline', async () => {
      const store = useAppStore;
      const db = await import('@goodboy/db');
      vi.mocked(db.insertSessionEvent).mockClear();
      store.setState({
        workspaces: [buildWorkspace()],
        currentWorkspaceId: WS_ID,
        sessions: [buildSession()],
      });

      await store.getState().archiveTask(SESSION_ID);
      await store.getState().unarchiveTask(SESSION_ID);

      const kinds = vi.mocked(db.insertSessionEvent).mock.calls.map(([{ event }]) => event.kind);
      expect(kinds).toEqual(['session_archived', 'session_restored']);
    });

    it('archiveTask keeps every worktree directory on disk', async () => {
      const store = useAppStore;
      const cleanupSessionMounts = vi.fn(async () => []);
      store.setState({
        workspaces: [buildWorkspace()],
        currentWorkspaceId: WS_ID,
        sessions: [buildSession()],
        cleanupSessionMounts,
      } as never);

      await store.getState().archiveTask(SESSION_ID);

      expect(cleanupSessionMounts).toHaveBeenCalledWith({
        sessionId: SESSION_ID,
        reason: 'archive',
      });
    });

    it('deleteTask removes an archived session from the archived cache', async () => {
      const store = useAppStore;
      const archived: Session = {
        ...buildSession(),
        archivedAt: NOW,
      } as Session;
      store.setState({
        workspaces: [buildWorkspace()],
        currentWorkspaceId: WS_ID,
        currentSessionId: SESSION_ID,
        archivedSessions: { [WS_ID]: [archived] },
        sessionProjectPrs: { [SESSION_ID]: {} },
        sessionSelectedPrNumber: { [SESSION_ID]: 40 },
        terminalTabs: { [SESSION_ID]: [] },
      });
      await store.getState().deleteTask(SESSION_ID);
      const s = store.getState();
      expect(s.archivedSessions[WS_ID]).toEqual([]);
      expect(s.currentSessionId).toBeNull();
      expect(s.sessionProjectPrs[SESSION_ID]).toBeUndefined();
      expect(s.sessionSelectedPrNumber[SESSION_ID]).toBeUndefined();
      expect(s.terminalTabs[SESSION_ID]).toBeUndefined();
    });

    it('deleteTask purges file versions for a branchless session', async () => {
      const store = useAppStore;
      store.setState({
        sessions: [buildSession()],
        workspaces: [buildWorkspace()],
        sessionBranches: { [SESSION_ID]: '' },
        sessionWorktrees: { [SESSION_ID]: ['/tmp/simple-space/sessions/test'] },
      });

      await store.getState().deleteTask(SESSION_ID);

      expect(storySpies.deleteFileVersionsForSession).toHaveBeenCalledWith({
        db: expect.anything(),
        sessionId: SESSION_ID,
      });
    });

    describe('bulk archived ops', () => {
      function buildArchived(id: SessionId, goal: string): Session {
        return {
          ...buildSession({ id, goal }),
          archivedAt: NOW,
        } as Session;
      }

      it('bulkArchiveTask archives every selected active session', async () => {
        const store = useAppStore;
        store.setState({
          workspaces: [buildWorkspace()],
          currentWorkspaceId: WS_ID,
          sessions: [buildSession(), buildSession({ id: SESSION_ID_2, goal: 'two' })],
        });
        await store.getState().bulkArchiveTask([SESSION_ID, SESSION_ID_2]);
        expect(store.getState().sessions).toEqual([]);
      });

      it('bulkArchiveTask keeps archiving after one session fails and reports the failure', async () => {
        const store = useAppStore;
        const { archiveSession } = await import('@goodboy/db');
        (archiveSession as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
          new Error('db down'),
        );
        store.setState({
          workspaces: [buildWorkspace()],
          currentWorkspaceId: WS_ID,
          sessions: [buildSession(), buildSession({ id: SESSION_ID_2, goal: 'two' })],
        });
        await store.getState().bulkArchiveTask([SESSION_ID, SESSION_ID_2]);
        expect(store.getState().sessions.map((x) => x.id)).toEqual([SESSION_ID]);
        expect(storySpies.insertNotification).toHaveBeenCalled();
      });

      it('bulkUnarchiveTask restores every selected session into the active list', async () => {
        const store = useAppStore;
        store.setState({
          workspaces: [buildWorkspace()],
          currentWorkspaceId: WS_ID,
          archivedSessions: {
            [WS_ID]: [buildArchived(SESSION_ID, 'one'), buildArchived(SESSION_ID_2, 'two')],
          },
        });
        await store.getState().bulkUnarchiveTask([SESSION_ID, SESSION_ID_2]);
        const s = store.getState();
        expect(s.sessions.map((x) => x.id).sort()).toEqual([SESSION_ID, SESSION_ID_2].sort());
        expect(s.archivedSessions[WS_ID]).toEqual([]);
      });

      it('bulkUnarchiveTask keeps restoring after one session fails and reports the failure', async () => {
        const store = useAppStore;
        const { unarchiveSession } = await import('@goodboy/db');
        (unarchiveSession as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
          new Error('db down'),
        );
        store.setState({
          workspaces: [buildWorkspace()],
          currentWorkspaceId: WS_ID,
          archivedSessions: {
            [WS_ID]: [buildArchived(SESSION_ID, 'bad'), buildArchived(SESSION_ID_2, 'good')],
          },
        });
        await store.getState().bulkUnarchiveTask([SESSION_ID, SESSION_ID_2]);
        const s = store.getState();
        expect(s.sessions.map((x) => x.id)).toEqual([SESSION_ID_2]);
        expect(s.archivedSessions[WS_ID]?.map((x) => x.id)).toEqual([SESSION_ID]);
        expect(storySpies.insertNotification).toHaveBeenCalled();
      });

      it('bulkDeleteTask removes every selected session from the archived cache', async () => {
        const store = useAppStore;
        store.setState({
          workspaces: [buildWorkspace()],
          currentWorkspaceId: WS_ID,
          archivedSessions: {
            [WS_ID]: [buildArchived(SESSION_ID, 'one'), buildArchived(SESSION_ID_2, 'two')],
          },
        });
        await store.getState().bulkDeleteTask([SESSION_ID, SESSION_ID_2]);
        expect(store.getState().archivedSessions[WS_ID]).toEqual([]);
      });

      it('bulkDeleteTask keeps deleting after one session throws', async () => {
        const store = useAppStore;
        const MISSING = 'session-missing' as SessionId;
        store.setState({
          workspaces: [buildWorkspace()],
          currentWorkspaceId: WS_ID,
          archivedSessions: {
            [WS_ID]: [buildArchived(SESSION_ID, 'one'), buildArchived(SESSION_ID_2, 'two')],
          },
        });
        await store.getState().bulkDeleteTask([MISSING, SESSION_ID, SESSION_ID_2]);
        expect(store.getState().archivedSessions[WS_ID]).toEqual([]);
      });

      it('bulkDeleteTask reports the exact failed-of-total count when a delete throws', async () => {
        const store = useAppStore;
        const MISSING = 'session-missing' as SessionId;
        const emitSpy = vi.fn<(...args: unknown[]) => Promise<undefined>>(async () => undefined);
        store.setState({
          workspaces: [buildWorkspace()],
          currentWorkspaceId: WS_ID,
          archivedSessions: {
            [WS_ID]: [buildArchived(SESSION_ID, 'one'), buildArchived(SESSION_ID_2, 'two')],
          },
          emitNotification: emitSpy as never,
        });
        await store.getState().bulkDeleteTask([MISSING, SESSION_ID]);
        expect(store.getState().archivedSessions[WS_ID]?.map((x) => x.id)).toEqual([SESSION_ID_2]);
        const summary = emitSpy.mock.calls.find((c) =>
          String((c[0] as { title: string }).title).startsWith("Couldn't delete"),
        );
        expect((summary?.[0] as { title: string } | undefined)?.title).toBe(
          "Couldn't delete 1 of 2 sessions",
        );
      });

      it('bulkDeleteTask deletes sequentially in the given id order', async () => {
        const store = useAppStore;
        const { purgeSessionForDelete } = await import('@goodboy/db');
        const spy = purgeSessionForDelete as unknown as ReturnType<typeof vi.fn>;
        store.setState({
          workspaces: [buildWorkspace()],
          currentWorkspaceId: WS_ID,
          archivedSessions: {
            [WS_ID]: [buildArchived(SESSION_ID, 'one'), buildArchived(SESSION_ID_2, 'two')],
          },
        });
        await store.getState().bulkDeleteTask([SESSION_ID_2, SESSION_ID]);
        expect(spy.mock.calls.map((c) => (c[0] as { id: string }).id)).toEqual([
          SESSION_ID_2,
          SESSION_ID,
        ]);
      });

      it('bulkDeleteTask is a no-op and emits no notification for an empty selection', async () => {
        const store = useAppStore;
        const { purgeSessionForDelete } = await import('@goodboy/db');
        await store.getState().bulkDeleteTask([]);
        expect(purgeSessionForDelete as unknown as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
        expect(storySpies.insertNotification).not.toHaveBeenCalled();
      });

      it('bulkUnarchiveTask is a no-op and emits no notification for an empty selection', async () => {
        const store = useAppStore;
        const { unarchiveSession } = await import('@goodboy/db');
        await store.getState().bulkUnarchiveTask([]);
        expect(unarchiveSession as unknown as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
        expect(storySpies.insertNotification).not.toHaveBeenCalled();
      });

      it('bulkUnarchiveTask reports failed-of-total when every restore fails', async () => {
        const store = useAppStore;
        const { unarchiveSession } = await import('@goodboy/db');
        (unarchiveSession as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
          new Error('db down'),
        );
        const emitSpy = vi.fn<(...args: unknown[]) => Promise<undefined>>(async () => undefined);
        store.setState({
          workspaces: [buildWorkspace()],
          currentWorkspaceId: WS_ID,
          archivedSessions: {
            [WS_ID]: [buildArchived(SESSION_ID, 'one'), buildArchived(SESSION_ID_2, 'two')],
          },
          emitNotification: emitSpy as never,
        });
        await store.getState().bulkUnarchiveTask([SESSION_ID, SESSION_ID_2]);
        const s = store.getState();
        expect(s.sessions).toEqual([]);
        expect(s.archivedSessions[WS_ID]?.map((x) => x.id).sort()).toEqual(
          [SESSION_ID, SESSION_ID_2].sort(),
        );
        const summary = emitSpy.mock.calls.find((c) =>
          String((c[0] as { title: string }).title).startsWith("Couldn't restore"),
        );
        expect((summary?.[0] as { title: string } | undefined)?.title).toBe(
          "Couldn't restore 2 of 2 sessions",
        );
      });
    });
  });

  describe('createSession mounts a project', () => {
    const MOUNT_PATH = '/tmp/repo/.goodboy/worktrees/study-plan';

    const primeMount = () => {
      storySpies.createWorktree.mockResolvedValueOnce({
        worktreePath: MOUNT_PATH,
        branchName: 'goodboy/study-plan',
        slug: 'study-plan',
        reused: false,
      });
    };

    it('mounts the picked project and works inside its worktree', async () => {
      const store = useAppStore;
      const db = await import('@goodboy/db');
      store.setState({ currentWorkspaceId: WS_ID });
      primeMount();

      const { session } = await store.getState().createSession({
        workspaceId: WS_ID,
        projectId: PROJECT_ID,
        goal: 'Study plan',
      });

      expect(storySpies.createWorktree).toHaveBeenCalledWith(
        expect.objectContaining({
          repoPath: '/tmp/repo',
          parentDir: '/tmp/repo/.goodboy/worktrees',
          dirName: expect.stringMatching(
            /^study-plan-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
          ),
        }),
      );
      expect(store.getState().sessionProjectMounts[session.id]).toEqual([
        expect.objectContaining({
          mountId: expect.any(String),
          projectId: PROJECT_ID,
          mountName: 'repo',
          worktreePath: MOUNT_PATH,
          repoRoot: '/tmp/repo',
          branch: 'goodboy/study-plan',
          isAttached: true,
          diskState: 'present',
          revision: 0,
        }),
      ]);
      expect(store.getState().sessionWorktrees[session.id]).toEqual([MOUNT_PATH]);
      expect(store.getState().sessionBranches[session.id]).toBe('goodboy/study-plan');
      expect(store.getState().sessionActiveProject[session.id]).toBe(PROJECT_ID);
      const firstMountId = store.getState().sessionProjectMounts[session.id]?.[0]?.mountId;
      expect(store.getState().sessionActiveMount[session.id]).toBe(firstMountId);
      expect(vi.mocked(db.updateSessionWriteDestination)).toHaveBeenCalledWith({
        db: expect.anything(),
        sessionId: session.id,
        mountId: firstMountId,
      });
      expect(vi.mocked(db.insertSessionWorktree)).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ worktreePath: MOUNT_PATH, projectId: PROJECT_ID }),
      );
      const kinds = vi.mocked(db.insertSessionEvent).mock.calls.map(([{ event }]) => event.kind);
      expect(kinds).toEqual(['project_materialized']);
    });

    it('mounts the project the caller picked when the workspace holds several', async () => {
      const store = useAppStore;
      const apiProject = buildProject({
        id: 'project-api' as ProjectId,
        name: 'api',
        rootPath: '/tmp/api',
      });
      const webProject = buildProject({
        id: 'project-web' as ProjectId,
        name: 'web',
        rootPath: '/tmp/web',
      });
      storySpies.listProjectsForWorkspace.mockResolvedValueOnce([apiProject, webProject]);
      store.setState({ currentWorkspaceId: WS_ID, projects: [apiProject, webProject] });
      storySpies.createWorktree.mockResolvedValueOnce({
        worktreePath: '/tmp/web/.goodboy/worktrees/ship-scope',
        branchName: 'goodboy/ship-scope',
        slug: 'ship-scope',
        reused: false,
      });

      const { session } = await store.getState().createSession({
        workspaceId: WS_ID,
        projectId: webProject.id,
        goal: 'Ship scope',
      });

      expect(storySpies.createWorktree).toHaveBeenCalledWith(
        expect.objectContaining({ repoPath: '/tmp/web' }),
      );
      expect(
        store.getState().sessionProjectMounts[session.id]?.map((mount) => mount.projectId),
      ).toEqual([webProject.id]);
    });

    it('creates a bare session when the workspace holds several projects and none was picked', async () => {
      const store = useAppStore;
      const db = await import('@goodboy/db');
      const apiProject = buildProject({
        id: 'project-api' as ProjectId,
        name: 'api',
        rootPath: '/tmp/api',
      });
      const webProject = buildProject({
        id: 'project-web' as ProjectId,
        name: 'web',
        rootPath: '/tmp/web',
      });
      storySpies.listProjectsForWorkspace.mockResolvedValueOnce([apiProject, webProject]);
      store.setState({ currentWorkspaceId: WS_ID, projects: [apiProject, webProject] });

      const { session } = await store
        .getState()
        .createSession({ workspaceId: WS_ID, goal: 'Ship scope' });

      expect(vi.mocked(db.insertSession)).toHaveBeenCalled();
      expect(storySpies.createWorktree).not.toHaveBeenCalled();
      expect(store.getState().sessions.map((s) => s.id)).toEqual([session.id]);
      expect(store.getState().sessionProjectMounts[session.id]).toEqual([]);
    });

    it('creates a bare session in a workspace with no project', async () => {
      const store = useAppStore;
      const db = await import('@goodboy/db');
      storySpies.listProjectsForWorkspace.mockResolvedValueOnce([]);
      store.setState({ currentWorkspaceId: WS_ID, projects: [] });

      const { session } = await store
        .getState()
        .createSession({ workspaceId: WS_ID, goal: 'Study plan' });

      expect(vi.mocked(db.insertSession)).toHaveBeenCalled();
      expect(storySpies.createWorktree).not.toHaveBeenCalled();
      expect(store.getState().sessionProjectMounts[session.id]).toEqual([]);
    });

    it('leaves no session behind when the worktree cannot be created', async () => {
      const store = useAppStore;
      const db = await import('@goodboy/db');
      store.setState({ currentWorkspaceId: WS_ID });
      storySpies.createWorktree.mockRejectedValueOnce(new Error('git worktree add failed'));

      await expect(
        store
          .getState()
          .createSession({ workspaceId: WS_ID, projectId: PROJECT_ID, goal: 'Study plan' }),
      ).rejects.toThrow('git worktree add failed');

      expect(store.getState().sessions).toEqual([]);
      expect(store.getState().currentSessionId).toBeNull();
      expect(vi.mocked(db.deleteSession)).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(String),
      );
    });

    it('mounts a folder project as a session directory inside the folder', async () => {
      const store = useAppStore;
      const folderProject = buildProject({ kind: 'folder', name: 'notes', rootPath: '/tmp/notes' });
      storySpies.listProjectsForWorkspace.mockResolvedValueOnce([folderProject]);
      store.setState({ currentWorkspaceId: WS_ID, projects: [folderProject] });
      storySpies.createSessionDir.mockResolvedValueOnce({
        worktreePath: '/tmp/notes/sessions/take-notes',
        branchName: '',
        slug: 'take-notes',
        reused: false,
      });

      const { session } = await store.getState().createSession({
        workspaceId: WS_ID,
        projectId: PROJECT_ID,
        goal: 'Take notes',
      });

      expect(storySpies.createWorktree).not.toHaveBeenCalled();
      expect(storySpies.createSessionDir).toHaveBeenCalledWith(
        expect.objectContaining({ basePath: '/tmp/notes', sessionId: session.id }),
      );
      expect(store.getState().sessionWorktrees[session.id]).toEqual([
        '/tmp/notes/sessions/take-notes',
      ]);
      expect(store.getState().sessionBranches[session.id]).toBe('');
    });

    it('seeds the workspace routing pool and includes its default provider', async () => {
      const store = useAppStore;
      store.setState({
        currentWorkspaceId: WS_ID,
        workspaceOverrides: {
          [WS_ID]: {
            ...buildWorkspace().overrides,
            defaultProviderId: 'codex',
            providerPool: ['anthropic'],
          },
        },
      });

      const { session } = await store
        .getState()
        .createSession({ workspaceId: WS_ID, goal: 'Study plan' });

      expect(session.providerPreference).toEqual({
        defaultProvider: 'codex',
        allowTurnOverride: true,
        enabledProviders: ['anthropic', 'codex'],
      });
    });

    it('records the mount and then the external task for a seeded creation', async () => {
      const store = useAppStore;
      const db = await import('@goodboy/db');
      store.setState({ currentWorkspaceId: WS_ID });
      primeMount();

      await store.getState().createSession({
        workspaceId: WS_ID,
        projectId: PROJECT_ID,
        goal: 'do gitlab work',
        externalTasks: [
          {
            provider: 'gitlab',
            externalId: '101',
            identifier: 'acme/web#7',
            url: 'https://gitlab.com/acme/web/-/issues/7',
            title: 'Fix the thing',
          },
        ],
      });

      const kinds = vi.mocked(db.insertSessionEvent).mock.calls.map(([{ event }]) => event.kind);
      expect(kinds).toEqual(['project_materialized', 'external_task_created']);
    });

    it('passes task identifiers into the initial materialization', async () => {
      const store = useAppStore;
      store.setState({ currentWorkspaceId: WS_ID });

      await store.getState().createSession({
        workspaceId: WS_ID,
        projectId: PROJECT_ID,
        goal: '[GRW-1220] [FE] Applicare nuove icone alla navbar',
        externalTasks: [
          {
            provider: 'linear',
            externalId: 'issue-1220',
            identifier: 'GRW-1220',
            url: 'https://linear.app/acme/issue/GRW-1220',
            title: 'Applicare nuove icone alla navbar',
          },
        ],
      });

      expect(storySpies.createWorktree).toHaveBeenCalledWith(
        expect.objectContaining({
          slug: 'grw-1220-applicare-nuove-icone-alla-navbar',
        }),
      );
    });

    it('does not freeze the default prefix or ordinary slug in the seed', async () => {
      const store = useAppStore;
      storySpies.listProjectsForWorkspace.mockResolvedValueOnce([]);
      store.setState({ currentWorkspaceId: WS_ID, projects: [] });

      const { session } = await store
        .getState()
        .createSession({ workspaceId: WS_ID, goal: 'Study plan' });

      expect(materializationSeedFor({ sessionId: session.id })).toEqual({});
    });

    it('uses the project branch prefix before the workspace prefix', async () => {
      const store = useAppStore;
      const project = buildProject({
        overrides: { ...buildWorkspace().overrides, defaultBranchPrefix: 'project-prefix' },
      });
      storySpies.listProjectsForWorkspace.mockResolvedValueOnce([project]);
      store.setState({
        currentWorkspaceId: WS_ID,
        projects: [project],
        workspaceOverrides: {
          [WS_ID]: { ...buildWorkspace().overrides, defaultBranchPrefix: 'workspace-prefix' },
        },
      });

      await store.getState().createSession({
        workspaceId: WS_ID,
        projectId: PROJECT_ID,
        goal: 'Study plan',
      });

      expect(storySpies.createWorktree).toHaveBeenCalledWith(
        expect.objectContaining({ branchPrefix: 'project-prefix' }),
      );
    });

    it('uses the workspace branch prefix when the project has none', async () => {
      const store = useAppStore;
      store.setState({
        currentWorkspaceId: WS_ID,
        workspaceOverrides: {
          [WS_ID]: { ...buildWorkspace().overrides, defaultBranchPrefix: 'workspace-prefix' },
        },
      });

      await store.getState().createSession({
        workspaceId: WS_ID,
        projectId: PROJECT_ID,
        goal: 'Study plan',
      });

      expect(storySpies.createWorktree).toHaveBeenCalledWith(
        expect.objectContaining({ branchPrefix: 'workspace-prefix' }),
      );
    });

    it('uses the session slug for an untitled mount', async () => {
      const store = useAppStore;
      store.setState({ currentWorkspaceId: WS_ID });

      const { session } = await store.getState().createSession({
        workspaceId: WS_ID,
        projectId: PROJECT_ID,
        goal: 'Untitled session',
      });

      expect(storySpies.createWorktree).toHaveBeenCalledWith(
        expect.objectContaining({ slug: `session-${session.id.slice(0, 8)}` }),
      );
    });

    it('sends an explicit branch slug already sanitized the way the backend would', async () => {
      const store = useAppStore;
      store.setState({ currentWorkspaceId: WS_ID });

      await store.getState().createSession({
        workspaceId: WS_ID,
        projectId: PROJECT_ID,
        goal: 'Study plan',
        branchSlug: 'Foreign_Feature/Exact',
      });

      expect(storySpies.createWorktree).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'foreign-feature-exact' }),
      );
    });

    it('pins a foreign prefix and keeps the adopted branch verbatim', async () => {
      const store = useAppStore;
      store.setState({ currentWorkspaceId: WS_ID });

      await store.getState().createSession({
        workspaceId: WS_ID,
        projectId: PROJECT_ID,
        goal: 'Review parser fix',
        existingBranch: 'alice/fix-parser',
      });

      expect(storySpies.createWorktree).toHaveBeenCalledWith(
        expect.objectContaining({
          branchPrefix: 'alice',
          slug: 'alice-fix-parser',
          existingBranch: 'alice/fix-parser',
        }),
      );
    });

    it('never asks the backend for a nested worktree directory', async () => {
      const store = useAppStore;
      store.setState({ currentWorkspaceId: WS_ID });

      await store.getState().createSession({
        workspaceId: WS_ID,
        projectId: PROJECT_ID,
        goal: 'Review parser fix',
        existingBranch: 'alice/fix-parser',
      });

      const [args] = storySpies.createWorktree.mock.calls[0] ?? [];

      expect(args?.dirName).not.toContain('/');
      expect(args?.dirName).toMatch(/^alice-fix-p-/);
    });
  });

  describe('ensureProjectMounted', () => {
    const API_PROJECT_ID = 'project-api' as ProjectId;
    const WEB_PROJECT_ID = 'project-web' as ProjectId;
    const DOCS_PROJECT_ID = 'project-docs' as ProjectId;
    const WEB_MOUNT_PATH = '/tmp/web/.goodboy/worktrees/ship-scope';

    const seedMultiProjectSession = async () => {
      const store = useAppStore;
      const apiProject = buildProject({ id: API_PROJECT_ID, name: 'api', rootPath: '/tmp/api' });
      const webProject = buildProject({ id: WEB_PROJECT_ID, name: 'web', rootPath: '/tmp/web' });
      storySpies.listProjectsForWorkspace.mockResolvedValueOnce([apiProject, webProject]);
      store.setState({ currentWorkspaceId: WS_ID, projects: [apiProject, webProject] });
      storySpies.createWorktree.mockResolvedValueOnce({
        worktreePath: WEB_MOUNT_PATH,
        branchName: 'goodboy/ship-scope',
        slug: 'ship-scope',
        reused: false,
      });
      const { session } = await store
        .getState()
        .createSession({ workspaceId: WS_ID, projectId: WEB_PROJECT_ID, goal: 'Ship scope' });
      storySpies.createWorktree.mockClear();
      const db = await import('@goodboy/db');
      vi.mocked(db.insertSessionEvent).mockClear();
      vi.mocked(db.insertSessionWorktree).mockClear();
      vi.mocked(db.updateSessionWriteDestination).mockClear();
      return { store, session };
    };

    it('mounts a second project inside that project repo', async () => {
      const { store, session } = await seedMultiProjectSession();
      const db = await import('@goodboy/db');
      const mountPath = '/tmp/api/.goodboy/worktrees/ship-scope';
      storySpies.createWorktree.mockResolvedValueOnce({
        worktreePath: mountPath,
        branchName: 'goodboy/ship-scope-api',
        slug: 'ship-scope-api',
        reused: false,
      });

      const outcome = await store.getState().ensureProjectMounted({
        sessionId: session.id,
        projectId: API_PROJECT_ID,
        reason: 'the plan implements the api first',
      });

      expect(storySpies.createWorktree).toHaveBeenCalledWith(
        expect.objectContaining({
          repoPath: '/tmp/api',
          parentDir: '/tmp/api/.goodboy/worktrees',
        }),
      );
      expect(vi.mocked(db.insertSessionWorktree)).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          sessionId: session.id,
          worktreePath: mountPath,
          branch: 'goodboy/ship-scope-api',
          projectId: API_PROJECT_ID,
          mountName: 'api',
        }),
      );
      expect(
        store.getState().sessionProjectMounts[session.id]?.map((entry) => entry.projectId),
      ).toEqual([WEB_PROJECT_ID, API_PROJECT_ID]);
      expect(store.getState().sessionActiveProject[session.id]).toBe(WEB_PROJECT_ID);
      expect(outcome.status).toBe('created');
      expect(outcome.mountIds).toHaveLength(1);
      expect(
        store
          .getState()
          .sessionProjectMounts[session.id]?.find((entry) => entry.projectId === API_PROJECT_ID)
          ?.worktreePath,
      ).toBe(mountPath);
      expect(
        store
          .getState()
          .sessionWorktreeRecords?.[session.id]?.find((row) => row.worktreePath === mountPath)
          ?.revision,
      ).toBe(0);
      const materialized = vi
        .mocked(db.insertSessionEvent)
        .mock.calls.map(([{ event }]) => event)
        .find((event) => event.kind === 'project_materialized');
      expect(materialized?.payload).toMatchObject({
        projectId: API_PROJECT_ID,
        projectName: 'api',
        branch: 'goodboy/ship-scope-api',
      });
    });

    it('records every mount so the diff surfaces see it without a workspace reload', async () => {
      const { store, session } = await seedMultiProjectSession();
      const mountPath = '/tmp/api/.goodboy/worktrees/ship-scope';
      storySpies.createWorktree.mockResolvedValueOnce({
        worktreePath: mountPath,
        branchName: 'goodboy/ship-scope-api',
        slug: 'ship-scope-api',
        reused: false,
      });

      await store.getState().ensureProjectMounted({
        sessionId: session.id,
        projectId: API_PROJECT_ID,
        reason: 'the plan implements the api first',
      });

      const records = store.getState().sessionWorktreeRecords?.[session.id] ?? [];
      expect(records.map((row) => row.worktreePath)).toEqual([WEB_MOUNT_PATH, mountPath]);
      expect(records.map((row) => row.projectId)).toEqual([WEB_PROJECT_ID, API_PROJECT_ID]);
    });

    it('answers already-mounted with every mount id instead of creating a second one', async () => {
      const { store, session } = await seedMultiProjectSession();
      storySpies.createWorktree.mockResolvedValueOnce({
        worktreePath: '/tmp/api/.goodboy/worktrees/ship-scope',
        branchName: 'goodboy/ship-scope-api',
        slug: 'ship-scope-api',
        reused: false,
      });

      const first = await store.getState().ensureProjectMounted({
        sessionId: session.id,
        projectId: API_PROJECT_ID,
        reason: 'first',
      });
      const second = await store.getState().ensureProjectMounted({
        sessionId: session.id,
        projectId: API_PROJECT_ID,
        reason: 'second',
      });

      expect(first.status).toBe('created');
      expect(second.status).toBe('already-mounted');
      expect(second.mountIds).toEqual(first.mountIds);
      expect(storySpies.createWorktree).toHaveBeenCalledTimes(1);
    });

    it('adopts every persisted row of that project and creates nothing', async () => {
      const { store, session } = await seedMultiProjectSession();
      const db = await import('@goodboy/db');
      vi.mocked(db.listWorktreesForSession).mockResolvedValueOnce([
        {
          id: 'row-mount',
          sessionId: session.id,
          worktreePath: '/tmp/api/.goodboy/worktrees/persisted',
          branch: 'goodboy/persisted',
          parallelIndex: 2,
          projectId: API_PROJECT_ID,
          mountName: 'api',
          revision: 6,
          createdAt: Date.now(),
        },
        {
          id: 'row-mount-two',
          sessionId: session.id,
          worktreePath: '/tmp/api/.goodboy/worktrees/persisted-two',
          branch: 'goodboy/persisted-two',
          parallelIndex: 3,
          projectId: API_PROJECT_ID,
          mountName: 'api',
          revision: 2,
          createdAt: Date.now(),
        },
      ]);

      const destinationBefore = store.getState().sessionActiveMount[session.id];

      const outcome = await store.getState().ensureProjectMounted({
        sessionId: session.id,
        projectId: API_PROJECT_ID,
        reason: 'mounted again after a reload',
      });

      expect(storySpies.createWorktree).not.toHaveBeenCalled();
      expect(outcome.status).toBe('already-mounted');
      expect(outcome.mountIds).toEqual(['row-mount', 'row-mount-two']);
      expect(vi.mocked(db.updateSessionWriteDestination)).not.toHaveBeenCalled();
      expect(store.getState().sessionActiveMount[session.id]).toBe(destinationBefore);
      expect(outcome.mountIds).not.toContain(destinationBefore);
      expect(
        store
          .getState()
          .sessionProjectMounts[session.id]?.filter((entry) => entry.projectId === API_PROJECT_ID)
          .map((entry) => entry.revision),
      ).toEqual([6, 2]);
      expect(vi.mocked(db.insertSessionEvent)).not.toHaveBeenCalled();
    });

    it('leaves the destination unselected when the database refuses to persist it', async () => {
      const { store, session } = await seedMultiProjectSession();
      const db = await import('@goodboy/db');
      vi.mocked(db.updateSessionWriteDestination).mockResolvedValueOnce(false);
      store.setState({
        sessionActiveMount: {},
        sessions: store
          .getState()
          .sessions.map((candidate) =>
            candidate.id === session.id
              ? ((({ activeMountId: _drop, ...rest }) => rest)(candidate) as typeof candidate)
              : candidate,
          ),
      });
      storySpies.createWorktree.mockResolvedValueOnce({
        worktreePath: '/tmp/api/.goodboy/worktrees/ship-scope',
        branchName: 'goodboy/ship-scope-api',
        slug: 'ship-scope-api',
        reused: false,
      });

      await store.getState().ensureProjectMounted({
        sessionId: session.id,
        projectId: API_PROJECT_ID,
        reason: 'the plan touches the api',
      });

      expect(store.getState().sessionActiveMount[session.id] ?? null).toBeNull();
      expect(
        store.getState().sessions.find((candidate) => candidate.id === session.id)?.activeMountId,
      ).toBeUndefined();
    });

    it('gives two projects mounted at once a parallel index each', async () => {
      const { store, session } = await seedMultiProjectSession();
      const db = await import('@goodboy/db');
      store.setState({
        projects: [
          ...store.getState().projects,
          buildProject({ id: DOCS_PROJECT_ID, name: 'docs', rootPath: '/tmp/docs' }),
        ],
      });
      const persisted: Array<Record<string, unknown>> = [
        {
          id: 'mount-web',
          sessionId: session.id,
          worktreePath: WEB_MOUNT_PATH,
          branch: 'goodboy/ship-scope',
          parallelIndex: 1,
          projectId: WEB_PROJECT_ID,
          mountName: 'web',
          revision: 0,
          createdAt: Date.now(),
        },
      ];
      const listRows = vi.mocked(db.listWorktreesForSession);
      const insertRow = vi.mocked(db.insertSessionWorktree);
      listRows.mockImplementation(async () => [...persisted] as never);
      insertRow.mockImplementation(async (_db: unknown, record: unknown) => {
        persisted.push(record as Record<string, unknown>);
      });
      storySpies.createWorktree.mockImplementation(async ({ slug }: { readonly slug: string }) => ({
        worktreePath: `/tmp/mounts/${slug}-${crypto.randomUUID()}`,
        branchName: `goodboy/${slug}`,
        slug,
        reused: false,
      }));
      let indexes: ReadonlyArray<number> = [];

      try {
        await Promise.all([
          store.getState().ensureProjectMounted({
            sessionId: session.id,
            projectId: API_PROJECT_ID,
            reason: 'the api first',
          }),
          store.getState().ensureProjectMounted({
            sessionId: session.id,
            projectId: DOCS_PROJECT_ID,
            reason: 'the docs too',
          }),
        ]);
        indexes = insertRow.mock.calls.map(([, record]) => record.parallelIndex);
      } finally {
        listRows.mockReset();
        listRows.mockResolvedValue([] as never);
        insertRow.mockReset();
        insertRow.mockResolvedValue(undefined);
        storySpies.createWorktree.mockReset();
      }

      expect(indexes).toHaveLength(2);
      expect(new Set(indexes).size).toBe(2);
    });

    it('never adopts a legacy row by mount name alone', async () => {
      const { store, session } = await seedMultiProjectSession();
      const db = await import('@goodboy/db');
      vi.mocked(db.listWorktreesForSession).mockResolvedValueOnce([
        {
          id: 'row-legacy',
          sessionId: session.id,
          worktreePath: '/tmp/api/.goodboy/worktrees/legacy',
          branch: 'goodboy/legacy',
          parallelIndex: 2,
          mountName: 'api',
          revision: 6,
          createdAt: Date.now(),
        },
      ]);
      storySpies.createWorktree.mockResolvedValueOnce({
        worktreePath: '/tmp/api/.goodboy/worktrees/ship-scope',
        branchName: 'goodboy/ship-scope-api',
        slug: 'ship-scope-api',
        reused: false,
      });

      const outcome = await store.getState().ensureProjectMounted({
        sessionId: session.id,
        projectId: API_PROJECT_ID,
        reason: 'mounted again after a reload',
      });

      expect(outcome.status).toBe('created');
      expect(storySpies.createWorktree).toHaveBeenCalledTimes(1);
    });

    it('refuses an empty reason before touching anything', async () => {
      const { store, session } = await seedMultiProjectSession();

      await expect(
        store.getState().ensureProjectMounted({
          sessionId: session.id,
          projectId: API_PROJECT_ID,
          reason: '   ',
        }),
      ).rejects.toThrow(/reason/);
      expect(storySpies.createWorktree).not.toHaveBeenCalled();
    });

    it('records a refusal event when the worktree cannot be created', async () => {
      const { store, session } = await seedMultiProjectSession();
      const db = await import('@goodboy/db');
      storySpies.createWorktree.mockRejectedValueOnce(new Error('git worktree add failed'));

      await expect(
        store.getState().ensureProjectMounted({
          sessionId: session.id,
          projectId: API_PROJECT_ID,
          reason: 'the plan touches the api',
        }),
      ).rejects.toThrow('git worktree add failed');

      const refused = vi
        .mocked(db.insertSessionEvent)
        .mock.calls.map(([{ event }]) => event)
        .find((event) => event.kind === 'project_materialization_refused');
      expect(refused?.payload).toMatchObject({ projectId: API_PROJECT_ID, projectName: 'api' });
      expect(
        store.getState().sessionProjectMounts[session.id]?.map((entry) => entry.projectId),
      ).toEqual([WEB_PROJECT_ID]);
    });

    it('registers a folder project mount without a branch', async () => {
      const store = useAppStore;
      const folderProject = buildProject({
        id: API_PROJECT_ID,
        name: 'notes',
        kind: 'folder',
        rootPath: '/tmp/notes',
      });
      const repoProject = buildProject({ id: WEB_PROJECT_ID, name: 'web', rootPath: '/tmp/web' });
      storySpies.listProjectsForWorkspace.mockResolvedValueOnce([folderProject, repoProject]);
      store.setState({ currentWorkspaceId: WS_ID, projects: [folderProject, repoProject] });
      storySpies.createWorktree.mockResolvedValueOnce({
        worktreePath: WEB_MOUNT_PATH,
        branchName: 'goodboy/take-notes',
        slug: 'take-notes',
        reused: false,
      });
      const { session } = await store
        .getState()
        .createSession({ workspaceId: WS_ID, projectId: WEB_PROJECT_ID, goal: 'Take notes' });
      storySpies.createSessionDir.mockResolvedValueOnce({
        worktreePath: '/tmp/notes/sessions/take-notes',
        branchName: '',
        slug: 'take-notes',
        reused: false,
      });

      await store.getState().ensureProjectMounted({
        sessionId: session.id,
        projectId: API_PROJECT_ID,
        reason: 'added manually by the user',
      });

      expect(storySpies.createSessionDir).toHaveBeenCalledWith(
        expect.objectContaining({ basePath: '/tmp/notes', sessionId: session.id }),
      );
      expect(
        store
          .getState()
          .sessionProjectMounts[session.id]?.find((entry) => entry.projectId === API_PROJECT_ID)
          ?.branch,
      ).toBe('');
      expect(store.getState().sessionBranches[session.id]).toBe('goodboy/take-notes');
    });

    it('stamps the detected repo slug on the materialized worktree row', async () => {
      const { store, session } = await seedMultiProjectSession();
      const db = await import('@goodboy/db');
      const core = await import('@goodboy/core');
      vi.mocked(core.detectRepoSlug).mockResolvedValueOnce('acme/goodboy');
      storySpies.createWorktree.mockResolvedValueOnce({
        worktreePath: '/tmp/api/.goodboy/worktrees/slug',
        branchName: 'goodboy/slug',
        slug: 'slug',
        reused: false,
      });

      await store.getState().ensureProjectMounted({
        sessionId: session.id,
        projectId: API_PROJECT_ID,
        reason: 'slug it',
      });

      await vi.waitFor(() => {
        expect(vi.mocked(db.updateSessionWorktreeRepoSlug)).toHaveBeenCalledWith({
          db: expect.anything(),
          sessionId: session.id,
          worktreePath: '/tmp/api/.goodboy/worktrees/slug',
          repoSlug: 'acme/goodboy',
        });
      });
    });
  });

  describe('createSession external task', () => {
    const GITLAB_TASK = {
      provider: 'gitlab' as const,
      externalId: '101',
      identifier: 'acme/web#7',
      url: 'https://gitlab.com/acme/web/-/issues/7',
      title: 'Fix the thing',
    };

    async function primeWorktree() {
      const { listWorkspaces } = await import('@goodboy/db');
      (listWorkspaces as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        buildWorkspace(),
      ]);
      storySpies.createWorktree.mockResolvedValueOnce({
        worktreePath: '/tmp/repo/wt',
        branchName: 'kay/101-fix-the-thing',
        slug: '101-fix-the-thing',
        reused: false,
      });
    }

    it('persists a gitlab external task and caches it on the session', async () => {
      const store = useAppStore;
      store.setState({ currentWorkspaceId: WS_ID });
      await primeWorktree();
      const { upsertSessionExternalTask } = await import('@goodboy/db');
      const spy = upsertSessionExternalTask as unknown as ReturnType<typeof vi.fn>;

      const { session } = await store.getState().createSession({
        workspaceId: WS_ID,
        goal: 'do gitlab work',
        externalTasks: [GITLAB_TASK],
      });

      expect(spy).toHaveBeenCalledTimes(1);
      const cached = store.getState().sessionExternalTasks[session.id];
      expect(cached?.[0]?.provider).toBe('gitlab');
      expect(cached?.[0]?.externalId).toBe('101');
      expect(cached?.[0]?.sessionId).toBe(session.id);
    });

    it('persists every task a session was created from, in the order they were picked', async () => {
      const LINEAR_TASK = {
        provider: 'linear' as const,
        externalId: 'iss-9',
        identifier: 'ENG-9',
        url: 'https://linear.app/acme/issue/ENG-9',
        title: 'Ship the retry',
      };
      const store = useAppStore;
      store.setState({ currentWorkspaceId: WS_ID });
      await primeWorktree();
      const { upsertSessionExternalTask } = await import('@goodboy/db');
      const spy = upsertSessionExternalTask as unknown as ReturnType<typeof vi.fn>;

      const { session } = await store.getState().createSession({
        workspaceId: WS_ID,
        goal: 'do both',
        externalTasks: [GITLAB_TASK, LINEAR_TASK],
      });

      expect(spy).toHaveBeenCalledTimes(2);
      expect(
        store.getState().sessionExternalTasks[session.id]?.map((task) => task.identifier),
      ).toEqual(['acme/web#7', 'ENG-9']);
    });

    it('keeps the tasks that persisted when one of several fails', async () => {
      const LINEAR_TASK = {
        provider: 'linear' as const,
        externalId: 'iss-9',
        identifier: 'ENG-9',
        url: 'https://linear.app/acme/issue/ENG-9',
        title: 'Ship the retry',
      };
      const store = useAppStore;
      const emitSpy = vi.fn(async () => undefined);
      store.setState({ currentWorkspaceId: WS_ID, emitNotification: emitSpy as never });
      await primeWorktree();
      const { upsertSessionExternalTask } = await import('@goodboy/db');
      (upsertSessionExternalTask as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('db down'),
      );

      const { session } = await store.getState().createSession({
        workspaceId: WS_ID,
        goal: 'do both',
        externalTasks: [GITLAB_TASK, LINEAR_TASK],
      });

      expect(
        store.getState().sessionExternalTasks[session.id]?.map((task) => task.identifier),
      ).toEqual(['ENG-9']);
      expect(emitSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'warning',
          title: "Couldn't link acme/web#7 to this session",
          body: 'acme/web#7: db down',
          sessionId: session.id,
        }),
      );
    });

    it('still creates the session and keys an empty task list when persistence fails', async () => {
      const store = useAppStore;
      store.setState({ currentWorkspaceId: WS_ID });
      await primeWorktree();
      const { upsertSessionExternalTask } = await import('@goodboy/db');
      (upsertSessionExternalTask as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('db down'),
      );

      const { session } = await store.getState().createSession({
        workspaceId: WS_ID,
        goal: 'do gitlab work',
        externalTasks: [GITLAB_TASK],
      });

      expect(session.id).toBeDefined();
      expect(store.getState().sessionExternalTasks[session.id]).toEqual([]);
    });
  });

  describe('createSession lands on Overview', () => {
    it('opens no studio and no lens for a newly created session', async () => {
      const store = useAppStore;
      store.setState({ currentWorkspaceId: WS_ID });
      const { listWorkspaces } = await import('@goodboy/db');
      (listWorkspaces as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        buildWorkspace(),
      ]);
      storySpies.createWorktree.mockResolvedValueOnce({
        worktreePath: '/tmp/repo/wt',
        branchName: 'kay/setup-workflow',
        slug: 'setup-workflow',
        reused: false,
      });

      const { session } = await store
        .getState()
        .createSession({ workspaceId: WS_ID, goal: 'ship it' });

      expect(store.getState().sessionStudio[session.id]).toBeNull();
      expect(store.getState().activeLens[session.id]).toBeNull();
    });

    it('seeds an empty question list so the badge never waits on a load nobody asked for', async () => {
      const store = useAppStore;
      store.setState({ currentWorkspaceId: WS_ID });
      const { listWorkspaces } = await import('@goodboy/db');
      (listWorkspaces as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        buildWorkspace(),
      ]);
      storySpies.createWorktree.mockResolvedValueOnce({
        worktreePath: '/tmp/repo/wt',
        branchName: 'kay/setup-workflow',
        slug: 'setup-workflow',
        reused: false,
      });

      const { session } = await store
        .getState()
        .createSession({ workspaceId: WS_ID, goal: 'ship it' });

      expect(store.getState().sessionOpenQuestions[session.id]).toEqual([]);
    });

    it('keys both overview collections so the pane never claims a load it never ran', async () => {
      const store = useAppStore;
      store.setState({ currentWorkspaceId: WS_ID });
      const { listWorkspaces } = await import('@goodboy/db');
      (listWorkspaces as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        buildWorkspace(),
      ]);
      storySpies.createWorktree.mockResolvedValueOnce({
        worktreePath: '/tmp/repo/wt',
        branchName: 'kay/setup-workflow',
        slug: 'setup-workflow',
        reused: false,
      });

      const { session } = await store
        .getState()
        .createSession({ workspaceId: WS_ID, goal: 'ship it' });

      expect(store.getState().sessionPlans[session.id]).toEqual([]);
      expect(store.getState().sessionPhaseRuns[session.id]).toBeDefined();
    });
  });

  describe('session external task links', () => {
    const LINEAR_TASK: Omit<SessionExternalTask, 'sessionId'> = {
      provider: 'linear',
      externalId: 'linear-42',
      identifier: 'GB-42',
      url: 'https://linear.app/acme/issue/GB-42',
      title: 'Link this issue',
      createdAt: NOW,
    };
    const SENTRY_TASK: Omit<SessionExternalTask, 'sessionId'> = {
      provider: 'sentry',
      externalId: 'sentry-7',
      identifier: 'GOODBOY-7',
      url: 'https://sentry.io/organizations/acme/issues/7/',
      title: 'TypeError',
      createdAt: NOW,
    };

    it('persists and caches every linked task', async () => {
      const store = useAppStore;
      const db = await import('@goodboy/db');

      await store.getState().linkSessionExternalTask(SESSION_ID, LINEAR_TASK);
      await store.getState().linkSessionExternalTask(SESSION_ID, SENTRY_TASK);

      expect(vi.mocked(db.upsertSessionExternalTask)).toHaveBeenCalledTimes(2);
      expect(store.getState().sessionExternalTasks[SESSION_ID]).toEqual([
        { ...LINEAR_TASK, sessionId: SESSION_ID },
        { ...SENTRY_TASK, sessionId: SESSION_ID },
      ]);
    });

    it('stamps the branch the session is on when an issue is linked', async () => {
      const store = useAppStore;
      const db = await import('@goodboy/db');
      store.setState({ sessionBranches: { [SESSION_ID]: 'ak/fix-auth' } });

      await store.getState().linkSessionExternalTask(SESSION_ID, LINEAR_TASK);

      const linkedTask = { ...LINEAR_TASK, sessionId: SESSION_ID, branch: 'ak/fix-auth' };
      expect(vi.mocked(db.upsertSessionExternalTask)).toHaveBeenCalledWith({
        db: expect.anything(),
        task: linkedTask,
      });
      expect(store.getState().sessionExternalTasks[SESSION_ID]).toEqual([linkedTask]);
    });

    it('attributes a linked task to the active project mount', async () => {
      const store = useAppStore;
      const db = await import('@goodboy/db');
      const projectId = 'project-member' as ProjectId;
      store.setState({
        sessions: [buildSession()],
        workspaces: [buildWorkspace()],
        projects: [buildProject({ id: projectId, rootPath: '/tmp/member' })],
        sessionProjectMounts: {
          [SESSION_ID]: [
            {
              projectId: projectId,
              mountName: 'member',
              worktreePath: '/tmp/member-worktree',
              repoRoot: '/tmp/member',
              branch: 'ak/member',
              mountId: 'mount-fixture-1' as MountId,
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
        sessionActiveProject: { [SESSION_ID]: projectId },
        sessionActiveMount: { [SESSION_ID]: 'mount-fixture-1' as MountId },
      });

      await store.getState().linkSessionExternalTask(SESSION_ID, LINEAR_TASK);

      const linkedTask = {
        ...LINEAR_TASK,
        sessionId: SESSION_ID,
        projectId: projectId,
        branch: 'ak/member',
      };
      expect(vi.mocked(db.upsertSessionExternalTask)).toHaveBeenCalledWith({
        db: expect.anything(),
        task: linkedTask,
      });
      expect(store.getState().sessionExternalTasks[SESSION_ID]).toEqual([linkedTask]);
    });

    it('persists a composite-key unlink and keeps the other tasks', async () => {
      const store = useAppStore;
      const db = await import('@goodboy/db');
      store.setState({
        sessionExternalTasks: {
          [SESSION_ID]: [
            { ...LINEAR_TASK, sessionId: SESSION_ID },
            { ...SENTRY_TASK, sessionId: SESSION_ID },
          ],
        },
      });

      await store
        .getState()
        .unlinkSessionExternalTask(SESSION_ID, LINEAR_TASK.provider, LINEAR_TASK.externalId);

      expect(vi.mocked(db.deleteSessionExternalTask)).toHaveBeenCalledWith({
        db: expect.anything(),
        sessionId: SESSION_ID,
        provider: 'linear',
        externalId: 'linear-42',
      });
      expect(store.getState().sessionExternalTasks[SESSION_ID]).toEqual([
        { ...SENTRY_TASK, sessionId: SESSION_ID },
      ]);
    });
  });

  describe('config', () => {
    it('setSessionConfig writes verbosity through', async () => {
      const store = useAppStore;
      store.setState({ sessions: [buildSession()] });
      await store.getState().setSessionConfig(SESSION_ID, { verbosity: 'brief' });
      expect(store.getState().sessions[0]?.verbosity).toBe('brief');
    });

    it('setAgentConfig writes verbosity through', async () => {
      const store = useAppStore;
      const agent = buildAgent({ id: AGENT_ID });
      store.setState({ sessionPhaseRuns: { [SESSION_ID]: [agent] } });
      await store.getState().setAgentConfig(SESSION_ID, AGENT_ID, { verbosity: 'normal' });
      const updated = store.getState().sessionPhaseRuns[SESSION_ID]?.find((r) => r.id === AGENT_ID);
      expect(updated?.verbosity).toBe('normal');
    });

    it('setAgentConfig syncs provider and model pins used by turn routing', async () => {
      const store = useAppStore;
      const agent = buildAgent({ id: AGENT_ID });
      store.setState({ sessionPhaseRuns: { [SESSION_ID]: [agent] } });
      await store.getState().setAgentConfig(SESSION_ID, AGENT_ID, {
        providerOverride: 'cursor',
        modelOverride: 'cursor-auto',
      });
      expect(store.getState().agentProviderOverride[AGENT_ID]).toBe('cursor');
      expect(store.getState().agentModelOverride[AGENT_ID]).toBe('cursor-auto');
      await store.getState().setAgentConfig(SESSION_ID, AGENT_ID, {
        providerOverride: null,
        modelOverride: null,
      });
      expect(store.getState().agentProviderOverride[AGENT_ID]).toBeUndefined();
      expect(store.getState().agentModelOverride[AGENT_ID]).toBeUndefined();
    });

    it('setAgentConfig syncs the effort used by turn routing', async () => {
      const store = useAppStore;
      const agent = buildAgent({ id: AGENT_ID });
      store.setState({ sessionPhaseRuns: { [SESSION_ID]: [agent] } });
      await store.getState().setAgentConfig(SESSION_ID, AGENT_ID, { effort: 'high' });
      expect(store.getState().agentEffortOverride[AGENT_ID]).toBe('high');
      await store.getState().setAgentConfig(SESSION_ID, AGENT_ID, { effort: null });
      expect(store.getState().agentEffortOverride[AGENT_ID]).toBeUndefined();
    });
  });
});

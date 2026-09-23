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
  MountId,
  PlanId,
  PlanWithCount,
  Project,
  ProjectId,
  PullRequestState,
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
const PROJECT_ID = 'project-1' as ProjectId;
const MOUNT_ID = 'mount-1' as MountId;
const MOUNT_ID_2 = 'mount-2' as MountId;
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

function buildProject(overrides: Partial<Project> = {}): Project {
  return {
    id: PROJECT_ID,
    workspaceId: WS_ID,
    name: 'repo',
    rootPath: '/tmp/repo',
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
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function buildSession(overrides: Partial<Session> = {}): Session {
  return {
    id: SESSION_ID,
    workspaceId: WS_ID,
    activeProjectId: PROJECT_ID,
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
      projects: [buildProject()],
      sessionProjectMounts: {
        [SESSION_ID]: [
          {
            mountId: MOUNT_ID,
            projectId: PROJECT_ID,
            mountName: 'repo',
            worktreePath: '/tmp/repo',
            repoRoot: '/tmp/repo',
            branch: 'goodboy/topic',
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
      sessionActiveProject: { [SESSION_ID]: PROJECT_ID },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('github', () => {
    it('refreshGithubStatus stores the status returned by the runner', async () => {
      const store = useAppStore;
      storySpies.ghStatus.mockResolvedValueOnce({
        available: true,
        mode: 'pat',
        user: 'tester',
        scopes: ['repo'],
      });
      await store.getState().refreshGithubStatus();
      expect(store.getState().githubStatus?.mode).toBe('pat');
    });

    it('refreshGithubStatus falls back to an absent status when ghStatus throws', async () => {
      const store = useAppStore;
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      storySpies.ghStatus.mockRejectedValueOnce(new Error('boom'));
      await store.getState().refreshGithubStatus();
      expect(store.getState().githubStatus?.available).toBe(false);
      expect(store.getState().githubStatus?.mode).toBe('absent');
      warnSpy.mockRestore();
    });

    it('setGithubPat stores the new status', async () => {
      const store = useAppStore;
      storySpies.ghSetToken.mockResolvedValueOnce({
        available: true,
        mode: 'pat',
        user: 'me',
        scopes: ['repo'],
      });
      const out = await store.getState().setGithubPat('tok');
      expect(out.mode).toBe('pat');
      expect(store.getState().githubStatus?.user).toBe('me');
    });

    it('refreshSessionPr noops for a session with no mount', async () => {
      const store = useAppStore;
      store.setState({
        workspaces: [buildWorkspace()],
        sessions: [buildSession()],
        sessionProjectMounts: {},
      });
      await store.getState().refreshSessionPr(SESSION_ID);
      expect(store.getState().sessionGithub[SESSION_ID]).toBeUndefined();
    });

    it('refreshSessionPr noops for a folder mount, which carries no branch', async () => {
      const store = useAppStore;
      store.setState({
        workspaces: [buildWorkspace()],
        projects: [buildProject({ kind: 'folder' })],
        sessions: [buildSession()],
        sessionProjectMounts: {
          [SESSION_ID]: [
            {
              mountId: MOUNT_ID,
              projectId: PROJECT_ID,
              mountName: 'repo',
              worktreePath: '/tmp/repo',
              repoRoot: '/tmp/repo',
              branch: '',
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
      await store.getState().refreshSessionPr(SESSION_ID);
      expect(store.getState().sessionGithub[SESSION_ID]).toBeUndefined();
    });

    it('keeps selection separate while a new canonical pr surfaces from one list fetch', async () => {
      const store = useAppStore;
      const selectedPr = {
        number: 40,
        title: 'Closed selection',
        state: 'closed',
        updatedAt: '2026-07-29T10:00:00Z',
      } as PullRequestState;
      const canonicalPr = {
        ...selectedPr,
        number: 42,
        title: 'New canonical',
        state: 'open',
        updatedAt: '2026-07-30T10:00:00Z',
      } as PullRequestState;
      storySpies.detectRepoSlug.mockResolvedValueOnce('acme/goodboy');
      storySpies.listPrsForBranch.mockResolvedValueOnce([canonicalPr, selectedPr]);
      store.setState({
        workspaces: [buildWorkspace()],
        sessions: [buildSession()],
        sessionBranches: { [SESSION_ID]: 'goodboy/topic' },
        sessionWorktrees: { [SESSION_ID]: ['/tmp/repo/.wt/topic'] },
        sessionProjectMounts: {
          [SESSION_ID]: [
            {
              mountId: MOUNT_ID,
              projectId: PROJECT_ID,
              mountName: 'repo',
              worktreePath: '/tmp/repo/.wt/topic',
              repoRoot: '/tmp/repo',
              branch: 'goodboy/topic',
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
        mountGithub: {
          [MOUNT_ID]: {
            mountId: MOUNT_ID,
            projectId: PROJECT_ID,
            revision: 0,
            repository: 'acme/goodboy',
            host: 'github.com',
            branch: 'goodboy/topic',
            prs: [selectedPr],
            links: [],
            pr: selectedPr,
            linkedIssues: [],
            fetchedAt: null,
            failedAt: null,
            loading: false,
            error: null,
            detail: null,
            detailFetchedAt: null,
            detailLoading: false,
            detailError: null,
          },
        },
        mountSelectedPr: {
          [MOUNT_ID]: {
            provider: 'github',
            host: 'github.com',
            repoSlug: 'acme/goodboy',
            prNumber: selectedPr.number,
          },
        },
      });

      await store.getState().refreshSessionPr(SESSION_ID, { force: true });

      expect(store.getState().sessionGithub[SESSION_ID]?.pr?.number).toBe(canonicalPr.number);
      expect(store.getState().sessionSelectedPrNumber[SESSION_ID]).toBe(selectedPr.number);
      expect(storySpies.listPrsForBranch).toHaveBeenCalledOnce();
    });

    it('keeps a fetch that lands after an active-project switch out of the session surface', async () => {
      const store = useAppStore;
      const otherProjectId = 'project-2' as ProjectId;
      const fetchedPr = {
        number: 42,
        title: 'From the previous mount',
        state: 'open',
        updatedAt: '2026-07-30T10:00:00Z',
      } as PullRequestState;
      storySpies.detectRepoSlug.mockResolvedValueOnce('acme/goodboy');
      storySpies.listPrsForBranch.mockImplementationOnce(async () => {
        store.setState((state) => {
          const nextGithub = { ...state.sessionGithub };
          delete nextGithub[SESSION_ID];
          return {
            sessionActiveProject: { [SESSION_ID]: otherProjectId },
            sessionGithub: nextGithub,
          };
        });
        return [fetchedPr];
      });
      store.setState({
        workspaces: [buildWorkspace()],
        projects: [
          buildProject(),
          buildProject({ id: otherProjectId, name: 'api', rootPath: '/tmp/api' }),
        ],
        sessions: [buildSession()],
        sessionBranches: { [SESSION_ID]: 'goodboy/topic' },
        sessionActiveProject: { [SESSION_ID]: PROJECT_ID },
        sessionProjectMounts: {
          [SESSION_ID]: [
            {
              mountId: MOUNT_ID,
              projectId: PROJECT_ID,
              mountName: 'repo',
              worktreePath: '/tmp/repo/.wt/topic',
              repoRoot: '/tmp/repo',
              branch: 'goodboy/topic',
              sessionId: SESSION_ID,
              lastWorktreePath: null,
              baseBranch: null,
              parallelIndex: 0,
              isAttached: true,
              diskState: 'present',
              revision: 0,
            },
            {
              mountId: MOUNT_ID_2,
              projectId: otherProjectId,
              mountName: 'api',
              worktreePath: '/tmp/api/.wt/topic',
              repoRoot: '/tmp/api',
              branch: 'goodboy/topic',
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

      await store.getState().refreshSessionPr(SESSION_ID, { force: true, mountId: MOUNT_ID });

      expect(store.getState().sessionGithub[SESSION_ID]).toBeUndefined();
      expect(store.getState().sessionProjectPrs[SESSION_ID]?.[PROJECT_ID]).toEqual([fetchedPr]);
    });

    it('caches the canonical pull request under its repository slug', async () => {
      const store = useAppStore;
      const db = await import('@goodboy/db');
      const canonicalPr = {
        number: 42,
        title: 'Ship the impact panel',
        url: 'https://github.com/acme/goodboy/pull/42',
        state: 'open',
        mergeable: true,
        checks: 'success',
        baseBranch: 'main',
        headBranch: 'goodboy/topic',
        isDraft: false,
        reviewDecision: null,
        body: 'a body nobody should cache',
        updatedAt: '2026-07-30T10:00:00Z',
      } as PullRequestState;
      storySpies.detectRepoSlug.mockResolvedValueOnce('acme/goodboy');
      storySpies.listPrsForBranch.mockResolvedValueOnce([canonicalPr]);
      store.setState({
        workspaces: [buildWorkspace()],
        sessions: [buildSession()],
        sessionBranches: { [SESSION_ID]: 'goodboy/topic' },
        sessionWorktrees: { [SESSION_ID]: ['/tmp/repo/.wt/topic'] },
        sessionProjectMounts: {
          [SESSION_ID]: [
            {
              mountId: MOUNT_ID,
              projectId: PROJECT_ID,
              mountName: 'repo',
              worktreePath: '/tmp/repo/.wt/topic',
              repoRoot: '/tmp/repo',
              branch: 'goodboy/topic',
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

      await store.getState().refreshSessionPr(SESSION_ID, { force: true });

      const entry = vi.mocked(db.upsertGithubPrCache).mock.calls[0]?.[1];
      expect(entry).toMatchObject({ branch: 'goodboy/topic', repoSlug: 'acme/goodboy' });
      expect(Object.keys(entry?.pr ?? {}).sort()).toEqual([
        'number',
        'state',
        'title',
        'updatedAt',
        'url',
      ]);
    });

    it('keeps the previous pr list and selection when listing fails', async () => {
      const store = useAppStore;
      const previousPr = {
        number: 40,
        title: 'Previous selection',
        state: 'closed',
        updatedAt: '2026-07-29T10:00:00Z',
      } as PullRequestState;
      storySpies.detectRepoSlug.mockResolvedValueOnce('acme/goodboy');
      storySpies.listPrsForBranch.mockRejectedValueOnce(new Error('authentication failed'));
      store.setState({
        workspaces: [buildWorkspace()],
        sessions: [buildSession()],
        sessionBranches: { [SESSION_ID]: 'goodboy/topic' },
        sessionWorktrees: { [SESSION_ID]: ['/tmp/repo/.wt/topic'] },
        mountGithub: {
          [MOUNT_ID]: {
            mountId: MOUNT_ID,
            projectId: PROJECT_ID,
            revision: 0,
            repository: 'acme/goodboy',
            host: 'github.com',
            branch: 'goodboy/topic',
            prs: [previousPr],
            links: [],
            pr: null,
            linkedIssues: [],
            fetchedAt: '2026-07-29T10:00:00.000Z' as IsoDateTime,
            failedAt: null,
            loading: false,
            error: null,
            detail: null,
            detailFetchedAt: null,
            detailLoading: false,
            detailError: null,
          },
        },
        mountSelectedPr: {
          [MOUNT_ID]: {
            provider: 'github',
            host: 'github.com',
            repoSlug: 'acme/goodboy',
            prNumber: previousPr.number,
          },
        },
      });

      await store.getState().refreshSessionPr(SESSION_ID, { force: true });

      expect(store.getState().sessionProjectPrs[SESSION_ID]?.[PROJECT_ID]).toEqual([previousPr]);
      expect(store.getState().sessionSelectedPrNumber[SESSION_ID]).toBe(previousPr.number);
    });

    it('records the failed attempt so a never-tried session stays distinguishable', async () => {
      const store = useAppStore;
      storySpies.detectRepoSlug.mockRejectedValueOnce(new Error('gh timed out'));
      store.setState({
        workspaces: [buildWorkspace()],
        sessions: [buildSession()],
        sessionBranches: { [SESSION_ID]: 'goodboy/topic' },
        sessionWorktrees: { [SESSION_ID]: ['/tmp/repo/.wt/topic'] },
      });

      await store.getState().refreshSessionPr(SESSION_ID, { force: true, silent: true });

      const github = store.getState().sessionGithub[SESSION_ID];
      expect(github?.fetchedAt).toBeNull();
      expect(github?.failedAt).not.toBeNull();
      expect(github?.loading).toBe(false);
    });

    it('clears the failed attempt once a later fetch lands', async () => {
      const store = useAppStore;
      storySpies.detectRepoSlug.mockRejectedValueOnce(new Error('gh timed out'));
      store.setState({
        workspaces: [buildWorkspace()],
        sessions: [buildSession()],
        sessionBranches: { [SESSION_ID]: 'goodboy/topic' },
        sessionWorktrees: { [SESSION_ID]: ['/tmp/repo/.wt/topic'] },
      });
      await store.getState().refreshSessionPr(SESSION_ID, { force: true, silent: true });
      expect(store.getState().sessionGithub[SESSION_ID]?.failedAt).not.toBeNull();

      storySpies.detectRepoSlug.mockResolvedValueOnce('acme/goodboy');
      storySpies.listPrsForBranch.mockResolvedValueOnce([]);
      await store.getState().refreshSessionPr(SESSION_ID, { force: true, silent: true });

      expect(store.getState().sessionGithub[SESSION_ID]?.failedAt).toBeNull();
      expect(store.getState().sessionGithub[SESSION_ID]?.fetchedAt).not.toBeNull();
    });

    it('sweepGithub is a no-op when github is unavailable', async () => {
      const store = useAppStore;
      store.setState({
        githubStatus: { available: false, mode: 'absent', scopes: [] } as never,
        sessions: [buildSession()],
        sessionBranches: { [SESSION_ID]: 'main' },
      });
      store.getState().sweepGithub();
      expect(store.getState().sessionGithub[SESSION_ID]).toBeUndefined();
    });
  });
});

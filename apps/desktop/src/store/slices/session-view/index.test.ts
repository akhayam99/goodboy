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
  ArtifactId,
  IsoDateTime,
  PlanId,
  PlanWithCount,
  ProviderRunId,
  Session,
  SessionExternalTask,
  SessionId,
  WorkflowRunId,
  Workspace,
  WorkspaceId,
} from '@goodboy/types';
import { LENS_KINDS } from './types';
import { sessionPlace } from '../navigation/place';
import { LENS_LABEL } from '../../../features/session/lens-labels';

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

function buildExternalTask(overrides: Partial<SessionExternalTask> = {}): SessionExternalTask {
  return {
    sessionId: SESSION_ID,
    provider: 'linear',
    externalId: 'ENG-42',
    identifier: 'ENG-42',
    url: 'https://linear.app/acme/issue/ENG-42',
    title: 'Track linked work',
    createdAt: NOW,
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

  describe('session-view', () => {
    it('getSessionViewPrefs returns defaults for a workspace with no stored prefs', async () => {
      const store = useAppStore;
      const prefs = store.getState().getSessionViewPrefs(WS_ID);
      expect(prefs).toEqual({ sort: 'updatedAt', group: 'stage' });
    });

    it('setSessionSort persists the chosen sort key', async () => {
      const store = useAppStore;
      store.getState().setSessionSort(WS_ID, 'goal');
      expect(store.getState().sessionViewPrefs[WS_ID]?.sort).toBe('goal');
    });

    it('setSessionGroup persists the chosen group key', async () => {
      const store = useAppStore;
      store.getState().setSessionGroup(WS_ID, 'pr');
      expect(store.getState().sessionViewPrefs[WS_ID]?.group).toBe('pr');
    });

    it('opening artifact creation clears the studio, the selected agent and the focused artifact', async () => {
      const store = useAppStore;
      store.getState().setSessionStudio(SESSION_ID, { kind: 'workflow' });
      store.getState().setFocusedArtifactId(SESSION_ID, PLAN_ID);
      store.getState().openArtifactCreation({ sessionId: SESSION_ID, kind: 'report' });
      expect(store.getState().artifactCreation[SESSION_ID]).toEqual({ kind: 'report', note: null });
      expect(store.getState().activeLens[SESSION_ID]).toBe('plans');
      expect(store.getState().sessionStudio[SESSION_ID]).toBeNull();
      expect(store.getState().selectedAgentId[SESSION_ID]).toBeNull();
      expect(store.getState().focusedArtifactId[SESSION_ID]).toBeNull();
      store.getState().closeArtifactCreation({ sessionId: SESSION_ID });
      expect(store.getState().artifactCreation[SESSION_ID]).toBeNull();
    });

    it('opening from a run rewrites the drafted scope to that run', async () => {
      const store = useAppStore;
      store.getState().setArtifactDraft({
        sessionId: SESSION_ID,
        draft: {
          kind: 'report',
          reportType: 'change-summary',
          attachments: [],
          mountIds: [],
          brief: 'the residual convention',
          basedOn: { kind: 'session' },
          routing: null,
          updatedAt: NOW,
        },
      });
      store.getState().openArtifactCreation({
        sessionId: SESSION_ID,
        kind: 'report',
        workflowRunId: 'run-ledger-1' as WorkflowRunId,
      });
      const draft = store.getState().artifactDrafts[SESSION_ID]?.report;
      expect(draft?.basedOn).toEqual({ kind: 'workflow-run', workflowRunId: 'run-ledger-1' });
      expect(draft?.brief).toBe('the residual convention');
    });

    it('LENS_KINDS holds every lens kind the union declares', () => {
      expect([...LENS_KINDS].sort()).toEqual(Object.keys(LENS_LABEL).sort());
    });

    it('toggleWorkflowExpand flips around the supplied default and persists per run', async () => {
      const store = useAppStore;
      store.getState().toggleWorkflowExpand(SESSION_ID, 'run-a', true);
      expect(store.getState().workflowExpand[SESSION_ID]?.['run-a']).toBe(false);
      store.getState().toggleWorkflowExpand(SESSION_ID, 'run-a', true);
      expect(store.getState().workflowExpand[SESSION_ID]?.['run-a']).toBe(true);
      store.getState().toggleWorkflowExpand(SESSION_ID, 'run-b', false);
      expect(store.getState().workflowExpand[SESSION_ID]?.['run-b']).toBe(true);
      expect(store.getState().workflowExpand[SESSION_ID]?.['run-a']).toBe(true);
    });

    it('setFocusedArtifactId and setSessionStudio update per-session state', async () => {
      const store = useAppStore;
      store.getState().setFocusedArtifactId(SESSION_ID, PLAN_ID);
      store.getState().setSessionStudio(SESSION_ID, { kind: 'workflow' });
      expect(store.getState().focusedArtifactId[SESSION_ID]).toBe(PLAN_ID);
      expect(store.getState().sessionStudio[SESSION_ID]).toEqual({ kind: 'workflow' });
    });

    it('focuses a plan and a report through the same artifact focus', async () => {
      const store = useAppStore;
      const artifactId = 'artifact-report' as ArtifactId;

      store.getState().setFocusedArtifactId(SESSION_ID, artifactId);
      expect(store.getState().focusedArtifactId[SESSION_ID]).toBe(artifactId);

      store.getState().setFocusedArtifactId(SESSION_ID, PLAN_ID);
      expect(store.getState().focusedArtifactId[SESSION_ID]).toBe(PLAN_ID);

      store.getState().setFocusedArtifactId(SESSION_ID, null);
      expect(store.getState().focusedArtifactId[SESSION_ID]).toBeNull();
    });

    it('focusedArtifactId survives the switch to the plans lens and dies on any other', async () => {
      const store = useAppStore;
      store.getState().setFocusedArtifactId(SESSION_ID, 'artifact-report' as ArtifactId);
      store.getState().setActiveLens(SESSION_ID, 'plans');
      expect(store.getState().focusedArtifactId[SESSION_ID]).toBe('artifact-report');
      store.getState().setActiveLens(SESSION_ID, 'agents');
      expect(store.getState().focusedArtifactId[SESSION_ID]).toBeNull();
    });

    it('setActiveLens clears the selected agent (foreground reconciliation)', async () => {
      const store = useAppStore;
      store.setState({ selectedAgentId: { [SESSION_ID]: AGENT_ID } } as never);
      store.getState().setActiveLens(SESSION_ID, 'agents');
      expect(store.getState().selectedAgentId[SESSION_ID]).toBeNull();
    });

    it('setActiveLens clears any open session studio', async () => {
      const store = useAppStore;
      store.getState().setSessionStudio(SESSION_ID, { kind: 'workflow' });
      store.getState().setActiveLens(SESSION_ID, 'agents');
      expect(store.getState().sessionStudio[SESSION_ID]).toBeNull();
    });

    it('setDiffFocus survives the switch to the files lens and dies on any other', async () => {
      const store = useAppStore;
      store
        .getState()
        .setDiffFocus(SESSION_ID, { kind: 'commit', sha: 'abc1234', path: 'src/a.ts' });
      store.getState().setActiveLens(SESSION_ID, 'files');
      expect(store.getState().diffFocus[SESSION_ID]).toEqual({
        kind: 'commit',
        sha: 'abc1234',
        path: 'src/a.ts',
      });
      store.getState().setActiveLens(SESSION_ID, 'agents');
      expect(store.getState().diffFocus[SESSION_ID]).toBeNull();
    });

    it('focusedGithubIssueNumber survives the switch to the github_issue lens and dies on any other', async () => {
      const store = useAppStore;
      store.getState().setFocusedGithubIssueNumber(SESSION_ID, 9);
      store.getState().setActiveLens(SESSION_ID, 'github_issue');
      expect(store.getState().focusedGithubIssueNumber[SESSION_ID]).toBe(9);
      store.getState().setActiveLens(SESSION_ID, 'agents');
      expect(store.getState().focusedGithubIssueNumber[SESSION_ID]).toBeNull();
    });

    it('openDiffLens lands on the files lens with the commit focus still set', async () => {
      const store = useAppStore;
      store.getState().setActiveLens(SESSION_ID, 'agents');
      store.getState().openDiffLens(SESSION_ID, { kind: 'commit', sha: 'abc1234', path: null });
      expect(store.getState().activeLens[SESSION_ID]).toBe('files');
      expect(store.getState().diffFocus[SESSION_ID]).toEqual({
        kind: 'commit',
        sha: 'abc1234',
        path: null,
      });
    });

    it('openDiffLens carries a working-tree focus and leaves a step to go back to', async () => {
      const store = useAppStore;
      store.getState().navigate({ to: sessionPlace({ sessionId: SESSION_ID, lens: 'review' }) });
      store.getState().openDiffLens(SESSION_ID, { kind: 'working', path: null });
      expect(store.getState().diffFocus[SESSION_ID]).toEqual({ kind: 'working', path: null });
      store.getState().back();
      expect(store.getState().activeLens[SESSION_ID]).toBe('review');
    });

    it.each([
      ['linear', 'linear'],
      ['gitlab', 'gitlab_issues'],
      ['jira', 'jira_issues'],
    ] as const)(
      'openExternalTaskLens lands on the %s lens with the clicked issue focused',
      async (provider, lens) => {
        const store = useAppStore;
        store
          .getState()
          .openExternalTaskLens(
            SESSION_ID,
            buildExternalTask({ provider, externalId: `${provider}-7` }),
          );
        expect(store.getState().activeLens[SESSION_ID]).toBe(lens);
        expect(store.getState().focusedExternalTask[SESSION_ID]).toEqual({
          provider,
          externalId: `${provider}-7`,
          projectId: null,
        });
      },
    );

    it.each(['linear', 'gitlab_issues', 'jira_issues'] as const)(
      'opening the %s lens on its own focuses no issue',
      async (lens) => {
        const store = useAppStore;
        store.getState().setActiveLens(SESSION_ID, lens);
        expect(store.getState().focusedExternalTask[SESSION_ID]).toBeNull();
      },
    );

    it.each([
      ['linear', 'linear'],
      ['gitlab', 'gitlab_issues'],
      ['jira', 'jira_issues'],
    ] as const)(
      'reopening the %s lens from the rail drops the issue a linked row had focused',
      async (provider, lens) => {
        const store = useAppStore;
        store.getState().openExternalTaskLens(SESSION_ID, buildExternalTask({ provider }));
        store.getState().setActiveLens(SESSION_ID, 'agents');
        expect(store.getState().focusedExternalTask[SESSION_ID]).toBeNull();
        store.getState().setActiveLens(SESSION_ID, lens);
        expect(store.getState().focusedExternalTask[SESSION_ID]).toBeNull();
      },
    );

    it('openExternalTaskLens sends a sentry issue to the inbox scoped to its session', async () => {
      const store = useAppStore;
      store.setState({ sessions: [buildSession()] } as never);
      store.getState().setActiveLens(SESSION_ID, 'agents');
      const detail = vi.fn();
      const listener = (event: Event) => {
        detail(event instanceof CustomEvent ? event.detail : null);
      };
      window.addEventListener('goodboy:open-inbox', listener);

      store
        .getState()
        .openExternalTaskLens(
          SESSION_ID,
          buildExternalTask({ provider: 'sentry', externalId: '12345' }),
        );

      window.removeEventListener('goodboy:open-inbox', listener);
      expect(detail).toHaveBeenCalledWith({
        workspaceId: WS_ID,
        provider: 'sentry',
        recordKey: 'sentry:error:12345',
        sessionId: SESSION_ID,
      });
      expect(store.getState().activeLens[SESSION_ID]).toBe('agents');
      expect(store.getState().focusedExternalTask[SESSION_ID]).toBeNull();
    });

    it('openExternalTaskLens sends a github task to the issue lens by its number', async () => {
      const store = useAppStore;
      store
        .getState()
        .openExternalTaskLens(
          SESSION_ID,
          buildExternalTask({ provider: 'github', externalId: '9', identifier: '#9' }),
        );
      expect(store.getState().activeLens[SESSION_ID]).toBe('github_issue');
      expect(store.getState().focusedGithubIssueNumber[SESSION_ID]).toBe(9);
      expect(store.getState().focusedExternalTask[SESSION_ID]).toBeNull();
    });

    it('openMountDiff selects the mount and leaves the focus null so the lens lands on the branch default', async () => {
      const store = useAppStore;
      store.getState().setActiveLens(SESSION_ID, 'agents');
      store.getState().setDiffFocus(SESSION_ID, { kind: 'working', path: null });
      store.getState().openMountDiff(SESSION_ID, '/wt/api');

      expect(store.getState().activeLens[SESSION_ID]).toBe('files');
      expect(store.getState().diffMountPath[SESSION_ID]).toBe('/wt/api');
      expect(store.getState().diffFocus[SESSION_ID]).toBeNull();
    });

    it('openMountDiff clears a commit focus a resolver link left behind', async () => {
      const store = useAppStore;
      store.getState().openDiffLens(SESSION_ID, { kind: 'commit', sha: 'abc1234', path: null });
      store.getState().openMountDiff(SESSION_ID, '/wt/web');

      expect(store.getState().diffFocus[SESSION_ID]).toBeNull();
      expect(store.getState().diffMountPath[SESSION_ID]).toBe('/wt/web');
    });

    it('openMountTerminal records the row worktree and switches to the terminal lens, without touching diff or scripts scope', async () => {
      const store = useAppStore;
      store.getState().setActiveLens(SESSION_ID, 'agents');
      store.getState().openMountTerminal(SESSION_ID, '/wt/api');

      expect(store.getState().activeLens[SESSION_ID]).toBe('terminal');
      expect(store.getState().terminalMountPath[SESSION_ID]).toBe('/wt/api');
    });

    it('opening a different row terminal updates only the terminal scope', async () => {
      const store = useAppStore;
      store.getState().openMountTerminal(SESSION_ID, '/wt/api');
      store.getState().openMountTerminal(SESSION_ID, '/wt/web');

      expect(store.getState().terminalMountPath[SESSION_ID]).toBe('/wt/web');
    });

    it('leaving the terminal lens clears the row scope it was opened with', async () => {
      const store = useAppStore;
      store.getState().openMountTerminal(SESSION_ID, '/wt/api');
      store.getState().setActiveLens(SESSION_ID, 'files');

      expect(store.getState().terminalMountPath[SESSION_ID]).toBeNull();
    });

    it('setSessionStudio(non-null) clears the selected agent', async () => {
      const store = useAppStore;
      store.setState({ selectedAgentId: { [SESSION_ID]: AGENT_ID } } as never);
      store.getState().setSessionStudio(SESSION_ID, { kind: 'workflow' });
      expect(store.getState().sessionStudio[SESSION_ID]).toEqual({ kind: 'workflow' });
      expect(store.getState().selectedAgentId[SESSION_ID]).toBeNull();
    });

    it('setSessionStudio(null) leaves the selected agent untouched', async () => {
      const store = useAppStore;
      store.setState({ selectedAgentId: { [SESSION_ID]: AGENT_ID } } as never);
      store.getState().setSessionStudio(SESSION_ID, null);
      expect(store.getState().selectedAgentId[SESSION_ID]).toBe(AGENT_ID);
    });

    it('selectAgent clears any open session studio (foreground reconciliation)', async () => {
      const store = useAppStore;
      store.setState({
        transcripts: { [AGENT_ID]: [] },
        sessionStudio: { [SESSION_ID]: { kind: 'workflow' } },
      } as never);
      await store.getState().selectAgent(SESSION_ID, AGENT_ID);
      expect(store.getState().selectedAgentId[SESSION_ID]).toBe(AGENT_ID);
      expect(store.getState().sessionStudio[SESSION_ID]).toBeNull();
    });
  });
});

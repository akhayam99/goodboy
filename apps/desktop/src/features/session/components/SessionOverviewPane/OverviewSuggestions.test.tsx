// @vitest-environment happy-dom

import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Agent,
  AgentEffort,
  PendingResolution,
  PlanId,
  PrComment,
  PrDetail,
  ProjectId,
  ProviderId,
  PullRequestState,
  Session,
  SessionProjectMount,
  Workflow,
} from '@goodboy/types';
import type { SessionSuggestion } from '../../../suggestions';

type SessionGithub = {
  readonly pr: PullRequestState | null;
  readonly detail?: PrDetail | null;
};

type StoreState = {
  sessionGithub: Record<string, SessionGithub>;
  sessionPendingResolutions: Record<string, ReadonlyArray<PendingResolution>>;
  sessionProjectMounts: Record<string, ReadonlyArray<SessionProjectMount>>;
  phaseTemplates: Record<string, ReadonlyArray<Workflow>>;
  sessionWorkflows: Record<string, ReadonlyArray<Workflow>>;
  sessions: ReadonlyArray<Session>;
  agentModelOverride: Record<string, string>;
  agentProviderOverride: Record<string, ProviderId>;
  agentEffortOverride: Record<string, AgentEffort>;
  activateNextResolver: ReturnType<typeof vi.fn>;
  emitNotification: ReturnType<typeof vi.fn>;
  setSessionActiveProject: ReturnType<typeof vi.fn>;
};

const { mocks, store } = vi.hoisted(() => {
  const store: StoreState = {
    sessionGithub: {},
    sessionPendingResolutions: {},
    sessionProjectMounts: {},
    phaseTemplates: {},
    sessionWorkflows: {},
    sessions: [],
    agentModelOverride: {},
    agentProviderOverride: {},
    agentEffortOverride: {},
    activateNextResolver: vi.fn(async () => undefined),
    emitNotification: vi.fn(async () => undefined),
    setSessionActiveProject: vi.fn(async () => undefined),
  };
  return {
    mocks: {
      suggestions: vi.fn(),
      advance: vi.fn(),
      spawnResolver: vi.fn(),
      runRebase: vi.fn(),
    },
    store,
  };
});

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: <T,>(selector: (state: StoreState) => T) => selector(store),
  useIsSessionCollectionLoaded: () => true,
}));

vi.mock('../../../suggestions', () => ({
  useSessionSuggestions: mocks.suggestions,
}));

vi.mock('../../../../shared/hooks/useSessionRoleModels', () => ({
  useSessionRoleModels: () => ({
    resolver: { providerId: 'codex', model: 'gpt-5.6', effort: 'high' },
  }),
}));

vi.mock('../../hooks/useResolverIndex', () => ({
  useResolverIndex: () => ({
    links: [],
    byThreadId: new Map(),
    byCommentUrl: new Map(),
    byDiffAgentId: new Map(),
  }),
}));

vi.mock('../../hooks/useResolverSpawner', () => ({
  useResolverSpawner: () => ({ spawnResolver: mocks.spawnResolver }),
}));

vi.mock('../../hooks/useWorktreeStatuses', () => ({
  useWorktreeStatuses: () =>
    new Map([['/worktree/api', { mainDistance: { behind: 2, ahead: 0 } }]]),
}));

vi.mock('../../hooks/useRebaseAgent', () => ({
  useRebaseAgent: () => ({ canRebase: true, isRunning: false, run: mocks.runRebase }),
}));

vi.mock('../../../workflows/useAdvanceWorkflowAgent', () => ({
  useAdvanceWorkflowAgent: () => mocks.advance,
}));

type WorkflowNextStepCtaProps = {
  readonly workflow: Workflow;
  readonly onAdvance: (params: {
    readonly step: Workflow['steps'][number];
    readonly isConfirmed: boolean;
  }) => void;
};

vi.mock('../../../workflows/components/WorkflowNextStepCta', () => ({
  WorkflowNextStepCta: ({ workflow, onAdvance }: WorkflowNextStepCtaProps) => (
    <button
      type="button"
      data-testid="workflow-next-step-cta"
      onClick={() => {
        const step = workflow.steps[0];
        if (step != null) {
          onAdvance({ step, isConfirmed: false });
        }
      }}
    >
      Start workflow step
    </button>
  ),
}));

vi.mock('@goodboy/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@goodboy/ui')>();
  return { ...actual, Tooltip: ({ children }: { readonly children: ReactNode }) => children };
});

import { OverviewSuggestions } from './OverviewSuggestions';

const SESSION: Session = JSON.parse(
  JSON.stringify({
    id: 'session-1',
    workspaceId: 'workspace-1',
    goal: 'Ship suggestions',
    state: 'idle',
    contextSlots: [],
    providerPreference: { defaultProvider: null },
    permissionMode: 'default',
    workflowRuns: [{ id: 'run-1', workflowId: 'workflow-1' }],
    autoRun: false,
    titleUserEdited: false,
    createdAt: '2026-09-03T08:00:00.000Z',
    updatedAt: '2026-09-03T08:00:00.000Z',
  }),
);

const WORKFLOW: Workflow = JSON.parse(
  JSON.stringify({
    id: 'workflow-1',
    workspaceId: 'workspace-1',
    name: 'Build',
    description: 'Build the feature',
    steps: [
      {
        id: 'step-1',
        workflowId: 'workflow-1',
        ordinal: 0,
        name: 'Implement',
        promptPrefix: 'Implement it',
      },
    ],
    createdAt: '2026-09-03T08:00:00.000Z',
    updatedAt: '2026-09-03T08:00:00.000Z',
  }),
);

const AGENT: Agent = JSON.parse(
  JSON.stringify({
    id: 'agent-1',
    sessionId: 'session-1',
    stepId: 'step-1',
    workflowRunId: 'run-1',
    ordinal: 0,
    name: 'Implement',
    status: 'pending',
  }),
);

const PROJECT_ID: ProjectId = JSON.parse(JSON.stringify('project-1'));

type CommentParams = {
  readonly id: string;
  readonly threadId: string;
};

const comment = ({ id, threadId }: CommentParams): PrComment => ({
  id,
  author: 'reviewer',
  authorAvatarUrl: null,
  body: `Fix ${id}`,
  createdAt: '2026-09-03T08:00:00.000Z',
  url: `https://github.com/acme/repo/pull/1#discussion_${id}`,
  source: 'review',
  path: 'src/index.ts',
  line: 10,
  resolved: false,
  threadId,
});

type RenderOverviewParams = {
  readonly onSelectQuestions?: () => void;
};

const renderOverview = ({ onSelectQuestions = vi.fn() }: RenderOverviewParams = {}) => {
  render(
    <OverviewSuggestions
      session={SESSION}
      agents={[AGENT]}
      onSelectQuestions={onSelectQuestions}
    />,
  );
  return { onSelectQuestions };
};

beforeEach(() => {
  mocks.suggestions.mockReset();
  mocks.suggestions.mockReturnValue([]);
  mocks.advance.mockReset();
  mocks.spawnResolver.mockReset();
  mocks.spawnResolver.mockResolvedValue('resolver-1');
  mocks.runRebase.mockReset();
  mocks.runRebase.mockResolvedValue(undefined);
  store.activateNextResolver.mockClear();
  store.emitNotification.mockClear();
  store.setSessionActiveProject.mockClear();
  store.sessionGithub = {};
  store.sessionPendingResolutions = {};
  store.sessionProjectMounts = {};
  store.phaseTemplates = { 'workspace-1': [WORKFLOW] };
  store.sessionWorkflows = {};
  store.sessions = [SESSION];
});

afterEach(cleanup);

describe('OverviewSuggestions', () => {
  it('renders the workflow CTA and advances its ready step', () => {
    mocks.suggestions.mockReturnValue([
      {
        id: 'workflow-next-step:run-1',
        kind: 'workflow-next-step',
        priority: 10,
        title: 'Continue Build',
        sessionId: SESSION.id,
        payload: { runId: SESSION.workflowRuns[0]!.id, stepId: WORKFLOW.steps[0]!.id },
      } satisfies SessionSuggestion,
    ]);

    renderOverview();
    fireEvent.click(screen.getByTestId('workflow-next-step-cta'));

    expect(mocks.advance).toHaveBeenCalledWith({ agent: AGENT, isConfirmed: false });
  });

  it('spawns one resolver per thread with resolver role defaults', async () => {
    mocks.suggestions.mockReturnValue([
      {
        id: 'resolve-threads:session-1',
        kind: 'resolve-threads',
        priority: 30,
        title: 'Resolve review comments',
        sessionId: SESSION.id,
        payload: { eligibleThreadCount: 2 },
      } satisfies SessionSuggestion,
    ]);
    store.sessionGithub = {
      'session-1': {
        pr: {
          number: 1,
          title: 'Suggestions',
          url: 'https://github.com/acme/repo/pull/1',
          state: 'open',
          mergeable: true,
          checks: 'success',
          baseBranch: 'main',
          headBranch: 'suggestions',
          isDraft: false,
          reviewDecision: null,
          body: '',
          updatedAt: '2026-09-03T08:00:00.000Z',
        },
        detail: {
          prNumber: 1,
          comments: [
            comment({ id: 'one', threadId: 'thread-1' }),
            comment({ id: 'two', threadId: 'thread-2' }),
          ],
          reviews: [],
          reviewRequests: [],
          checks: [],
        },
      },
    };

    renderOverview();
    fireEvent.click(screen.getByRole('button', { name: 'Resolve' }));

    await waitFor(() => expect(mocks.spawnResolver).toHaveBeenCalledTimes(2));
    expect(mocks.spawnResolver).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        choice: { provider: 'codex', model: 'gpt-5.6', effort: 'high' },
        deferKickoff: true,
      }),
    );
    expect(mocks.spawnResolver).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        choice: { provider: 'codex', model: 'gpt-5.6', effort: 'high' },
        deferKickoff: true,
      }),
    );
    expect(store.activateNextResolver).toHaveBeenCalledWith(SESSION.id);
  });

  it('runs the rebase agent for the suggested project', async () => {
    mocks.suggestions.mockReturnValue([
      {
        id: 'rebase-project:project-1',
        kind: 'rebase-project',
        priority: 40,
        title: 'Rebase API on main',
        sessionId: SESSION.id,
        payload: {
          projectId: PROJECT_ID,
          worktreePath: '/worktree/api',
          baseBranch: 'main',
          behind: 2,
        },
      } satisfies SessionSuggestion,
    ]);
    store.sessionProjectMounts = {
      'session-1': [
        {
          projectId: PROJECT_ID,
          mountName: 'API',
          worktreePath: '/worktree/api',
          repoRoot: '/repo/api',
          branch: 'suggestions',
        },
      ],
    };

    renderOverview();
    fireEvent.click(screen.getByRole('button', { name: 'Rebase' }));

    await waitFor(() => expect(mocks.runRebase).toHaveBeenCalledOnce());
    expect(store.setSessionActiveProject).toHaveBeenCalledWith({
      sessionId: SESSION.id,
      projectId: PROJECT_ID,
    });
  });

  it('selects the questions lens', () => {
    mocks.suggestions.mockReturnValue([
      {
        id: 'answer-questions:session-1',
        kind: 'answer-questions',
        priority: 0,
        title: 'Answer open questions',
        sessionId: SESSION.id,
        payload: { count: 1 },
      } satisfies SessionSuggestion,
    ]);
    const { onSelectQuestions } = renderOverview();

    fireEvent.click(screen.getByRole('button', { name: 'Answer' }));

    expect(onSelectQuestions).toHaveBeenCalledOnce();
  });

  it('renders nothing when the engine has no suggestions', () => {
    const { container } = render(
      <OverviewSuggestions session={SESSION} agents={[]} onSelectQuestions={vi.fn()} />,
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when the only suggestions belong to other surfaces', () => {
    mocks.suggestions.mockReturnValue([
      {
        id: 'plan-ready:plan-1',
        kind: 'plan-ready',
        priority: 20,
        title: 'Run the plan',
        sessionId: SESSION.id,
        payload: { planId: 'plan-1' as PlanId },
      } satisfies SessionSuggestion,
    ]);

    const { container } = render(
      <OverviewSuggestions session={SESSION} agents={[]} onSelectQuestions={vi.fn()} />,
    );

    expect(container.firstChild).toBeNull();
  });
});

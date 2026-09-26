import { describe, expect, it } from 'vitest';
import type {
  AgentId,
  MountId,
  PlanId,
  ProjectId,
  PullRequestState,
  SessionEventId,
  SessionId,
  StepId,
  WorkflowId,
  WorkflowRunId,
} from '@goodboy/types';
import {
  deriveNextSteps,
  type SuggestionAgent,
  type SuggestionCleanupProposal,
  type SuggestionMount,
} from './deriveNextSteps';
import type {
  SuggestionMountEvent,
  SuggestionMountEventKind,
} from '../../store/materializationProposals';

const sessionId = 'session-1' as SessionId;
const planId = 'plan-1' as PlanId;
const webId = 'project-web' as ProjectId;
const webMountId = 'mount-web' as MountId;

const mountEvent = ({
  id,
  kind,
  projectId = webId,
}: {
  readonly id: string;
  readonly kind: SuggestionMountEventKind;
  readonly projectId?: ProjectId;
}): SuggestionMountEvent => ({
  eventId: id as SessionEventId,
  kind,
  projectId,
  projectName: 'web',
  reason: 'needs the router',
  agentId: 'agent-1' as AgentId,
  turnRunId: null,
  cause: 'scope',
  hasRecordedReason: true,
});

const derive = ({
  openQuestionCount = 0,
  isRunning = false,
  creatorHasOpenQuestions = false,
  consumedPlanIds = new Set<PlanId>(),
  hasPullRequest = false,
  eligibleThreadCount = 0,
  mainDistance = null,
  mountEvents = [],
}: {
  openQuestionCount?: number;
  isRunning?: boolean;
  creatorHasOpenQuestions?: boolean;
  consumedPlanIds?: ReadonlySet<PlanId>;
  hasPullRequest?: boolean;
  eligibleThreadCount?: number;
  mainDistance?: number | null;
  mountEvents?: ReadonlyArray<SuggestionMountEvent>;
}) =>
  deriveNextSteps({
    sessionId,
    workflowRuns: [
      {
        id: 'run-1' as WorkflowRunId,
        title: 'Build',
        advanceState: { kind: 'ready', stepId: 'step-1' as StepId },
        isRunning,
      },
    ],
    plans: [{ id: planId, title: 'Plan', status: 'active', creatorHasOpenQuestions }],
    consumedPlanIds,
    openQuestionCount,
    hasPullRequest,
    eligibleThreadCount,
    mountEvents,
    projects: [
      {
        id: 'mount:mount-1',
        mountId: 'mount-1' as MountId,
        projectId: 'project-1' as ProjectId,
        projectName: 'Goodboy',
        branch: 'feature/goodboy',
        worktreePath: '/tmp/goodboy',
        baseBranch: 'main',
        mainDistance,
      },
    ],
  });

describe('deriveNextSteps', () => {
  it('ranks all suggestion kinds', () => {
    const suggestions = derive({
      openQuestionCount: 2,
      hasPullRequest: true,
      eligibleThreadCount: 1,
      mainDistance: 3,
      mountEvents: [mountEvent({ id: 'event-1', kind: 'proposed' })],
    });
    expect(suggestions.map((suggestion) => suggestion.kind)).toEqual([
      'answer-questions',
      'mount-project',
      'workflow-next-step',
      'plan-ready',
      'resolve-threads',
      'rebase-project',
    ]);
    expect(suggestions[0]?.payload).toEqual({ count: 2 });
  });

  it('uses the shared plan-ready union gates', () => {
    expect(derive({ isRunning: true }).some((suggestion) => suggestion.kind === 'plan-ready')).toBe(
      false,
    );
    expect(
      derive({ creatorHasOpenQuestions: true }).some(
        (suggestion) => suggestion.kind === 'plan-ready',
      ),
    ).toBe(false);
    expect(
      derive({ consumedPlanIds: new Set([planId]) }).some(
        (suggestion) => suggestion.kind === 'plan-ready',
      ),
    ).toBe(false);
    expect(derive({}).some((suggestion) => suggestion.kind === 'plan-ready')).toBe(true);
  });

  it('carries the eligible thread count and needs a pull request', () => {
    const suggestions = derive({ hasPullRequest: true, eligibleThreadCount: 1 });
    expect(
      suggestions.find((suggestion) => suggestion.kind === 'resolve-threads')?.payload,
    ).toEqual({ eligibleThreadCount: 1 });
    expect(
      derive({ hasPullRequest: false, eligibleThreadCount: 1 }).some(
        (suggestion) => suggestion.kind === 'resolve-threads',
      ),
    ).toBe(false);
  });

  it('carries the proposal payload the timeline row acts on', () => {
    const suggestion = derive({
      mountEvents: [mountEvent({ id: 'event-1', kind: 'proposed' })],
    }).find((candidate) => candidate.kind === 'mount-project');

    expect(suggestion?.title).toBe('Add web');
    expect(suggestion?.detail).toBe('needs the router');
    expect(suggestion?.payload).toEqual({
      projectId: webId,
      projectName: 'web',
      reason: 'needs the router',
      agentId: 'agent-1',
      eventId: 'event-1',
    });
  });

  it('clears a proposal once the project is mounted or the proposal is dismissed', () => {
    const mounted = derive({
      mountEvents: [
        mountEvent({ id: 'event-1', kind: 'proposed' }),
        mountEvent({ id: 'event-2', kind: 'mounted' }),
      ],
    });
    const dismissed = derive({
      mountEvents: [
        mountEvent({ id: 'event-1', kind: 'proposed' }),
        mountEvent({ id: 'event-2', kind: 'dismissed' }),
      ],
    });
    const reproposed = derive({
      mountEvents: [
        mountEvent({ id: 'event-1', kind: 'proposed' }),
        mountEvent({ id: 'event-2', kind: 'dismissed' }),
        mountEvent({ id: 'event-3', kind: 'proposed' }),
      ],
    });

    expect(mounted.some((suggestion) => suggestion.kind === 'mount-project')).toBe(false);
    expect(dismissed.some((suggestion) => suggestion.kind === 'mount-project')).toBe(false);
    expect(reproposed.some((suggestion) => suggestion.kind === 'mount-project')).toBe(true);
  });

  it('keeps a proposal a settled event for another project never touched', () => {
    const suggestions = derive({
      mountEvents: [
        mountEvent({ id: 'event-1', kind: 'proposed' }),
        mountEvent({ id: 'event-2', kind: 'mounted', projectId: 'project-docs' as ProjectId }),
      ],
    });

    expect(suggestions.filter((suggestion) => suggestion.kind === 'mount-project')).toHaveLength(1);
  });

  it('hides the rebase once a request covers the same distance and its agent did not fail', () => {
    const project = {
      id: 'mount:mount-web',
      mountId: webMountId,
      projectId: webId,
      projectName: 'web',
      branch: 'feature/web',
      worktreePath: '/tmp/web',
      baseBranch: 'main',
      mainDistance: 126,
    };
    const rebaseIds = ({
      rebaseRequest,
      mainDistance = 126,
    }: {
      readonly rebaseRequest: {
        readonly behind: number | null;
        readonly baseBranch?: string | null;
        readonly agentStatus: string | null;
      };
      readonly mainDistance?: number;
    }) =>
      deriveNextSteps({
        sessionId,
        workflowRuns: [],
        plans: [],
        consumedPlanIds: new Set<PlanId>(),
        openQuestionCount: 0,
        hasPullRequest: false,
        eligibleThreadCount: 0,
        mountEvents: [],
        projects: [
          {
            ...project,
            mainDistance,
            rebaseRequest: { baseBranch: 'main', ...rebaseRequest },
          },
        ],
      }).map((suggestion) => suggestion.id);

    expect(rebaseIds({ rebaseRequest: { behind: 126, agentStatus: 'running' } })).toEqual([]);
    expect(rebaseIds({ rebaseRequest: { behind: 126, agentStatus: 'completed' } })).toEqual([]);
    expect(rebaseIds({ rebaseRequest: { behind: 126, agentStatus: null } })).toEqual([]);
    expect(
      rebaseIds({ rebaseRequest: { behind: 126, baseBranch: null, agentStatus: 'running' } }),
    ).toEqual([]);
    expect(rebaseIds({ rebaseRequest: { behind: 126, agentStatus: 'failed' } })).toEqual([
      'rebase-project:session-1',
    ]);
    expect(
      rebaseIds({ rebaseRequest: { behind: 126, agentStatus: 'completed' }, mainDistance: 129 }),
    ).toEqual(['rebase-project:session-1']);
    expect(
      rebaseIds({ rebaseRequest: { behind: 126, baseBranch: 'develop', agentStatus: 'running' } }),
    ).toEqual(['rebase-project:session-1']);
  });

  it('collapses two mounts of one project into one ordered rebase suggestion', () => {
    const suggestions = deriveNextSteps({
      sessionId,
      workflowRuns: [],
      plans: [],
      consumedPlanIds: new Set<PlanId>(),
      openQuestionCount: 0,
      hasPullRequest: false,
      eligibleThreadCount: 0,
      mountEvents: [],
      projects: [
        {
          id: 'mount:mount-second',
          mountId: 'mount-second' as MountId,
          projectId: webId,
          projectName: 'web',
          branch: 'feature/second',
          worktreePath: '/tmp/web-second',
          baseBranch: 'main',
          mainDistance: 2,
        },
        {
          id: 'mount:mount-first',
          mountId: 'mount-first' as MountId,
          projectId: webId,
          projectName: 'web',
          branch: 'feature/first',
          worktreePath: '/tmp/web-first',
          baseBranch: 'main',
          mainDistance: 7,
        },
      ],
    });

    const rebase = suggestions.find((suggestion) => suggestion.kind === 'rebase-project');
    expect(suggestions.filter((suggestion) => suggestion.kind === 'rebase-project')).toHaveLength(
      1,
    );
    expect(rebase?.title).toBe('Rebase web');
    expect(rebase?.detail).toBe('2 branches behind');
    expect(rebase?.payload.targets.map((target) => target.mountId)).toEqual([
      'mount-first',
      'mount-second',
    ]);
  });

  it('sorts several projects by distance and then project name without reordering ties', () => {
    const suggestions = deriveNextSteps({
      sessionId,
      workflowRuns: [],
      plans: [],
      consumedPlanIds: new Set<PlanId>(),
      openQuestionCount: 0,
      hasPullRequest: false,
      eligibleThreadCount: 0,
      mountEvents: [],
      projects: [
        {
          id: 'mount:mount-zulu',
          mountId: 'mount-zulu' as MountId,
          projectId: 'project-zulu' as ProjectId,
          projectName: 'Zulu',
          branch: 'feature/zulu',
          worktreePath: '/tmp/zulu',
          baseBranch: 'main',
          mainDistance: 3,
        },
        {
          id: 'mount:mount-alpha-first',
          mountId: 'mount-alpha-first' as MountId,
          projectId: 'project-alpha' as ProjectId,
          projectName: 'Alpha',
          branch: 'feature/alpha-first',
          worktreePath: '/tmp/alpha-first',
          baseBranch: 'main',
          mainDistance: 3,
        },
        {
          id: 'mount:mount-alpha-second',
          mountId: 'mount-alpha-second' as MountId,
          projectId: 'project-alpha' as ProjectId,
          projectName: 'Alpha',
          branch: 'feature/alpha-second',
          worktreePath: '/tmp/alpha-second',
          baseBranch: 'main',
          mainDistance: 3,
        },
        {
          id: 'mount:mount-far',
          mountId: 'mount-far' as MountId,
          projectId: 'project-far' as ProjectId,
          projectName: 'Far',
          branch: 'feature/far',
          worktreePath: '/tmp/far',
          baseBranch: 'develop',
          mainDistance: 8,
        },
      ],
    });

    const rebase = suggestions.find((suggestion) => suggestion.kind === 'rebase-project');
    expect(rebase?.title).toBe('Rebase 4 branches');
    expect(rebase?.detail).toBe('3 projects behind');
    expect(rebase?.payload.targets.map((target) => target.mountId)).toEqual([
      'mount-far',
      'mount-alpha-first',
      'mount-alpha-second',
      'mount-zulu',
    ]);
  });
});

const BASE_PARAMS = {
  sessionId,
  workflowRuns: [],
  plans: [],
  consumedPlanIds: new Set<PlanId>(),
  openQuestionCount: 0,
  hasPullRequest: false,
  eligibleThreadCount: 0,
  mountEvents: [],
  projects: [],
};

const agent = (overrides: Partial<SuggestionAgent> = {}): SuggestionAgent => ({
  id: 'agent-1' as AgentId,
  label: 'Implementer',
  roleKind: 'implementer',
  status: 'completed',
  workflowRunId: null,
  ordinal: 1,
  pendingSignal: null,
  ...overrides,
});

const pr = (overrides: Partial<PullRequestState> = {}): PullRequestState => ({
  number: 618,
  title: 'Fix it',
  url: 'https://github.com/acme/repo/pull/618',
  state: 'open',
  mergeable: true,
  checks: 'success',
  baseBranch: 'main',
  headBranch: 'feature',
  isDraft: false,
  reviewDecision: null,
  body: '',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const mount = (overrides: Partial<SuggestionMount> = {}): SuggestionMount => ({
  mountId: webMountId,
  projectId: webId,
  projectName: 'web',
  branch: 'feature/web',
  worktreePath: '/tmp/web',
  aheadOfUpstream: null,
  aheadOfBase: null,
  isClean: true,
  pr: null,
  fetchedAt: null,
  ...overrides,
});

const cleanupProposal = (
  overrides: Partial<SuggestionCleanupProposal> = {},
): SuggestionCleanupProposal => ({
  requestId: 'cleanup:merge_cleanup:mount-web:feature/web',
  mountId: webMountId,
  projectName: 'web',
  branch: 'feature/web',
  prNumber: 612,
  ...overrides,
});

describe('deriveNextSteps eleven new kinds', () => {
  it('suggests approving a pending permission request', () => {
    const suggestions = deriveNextSteps({
      ...BASE_PARAMS,
      agents: [
        agent({
          pendingSignal: { kind: 'permission', toolUseId: 'tool-1', toolName: 'pnpm test' },
        }),
      ],
    });
    const suggestion = suggestions.find((candidate) => candidate.kind === 'approve-tool');
    expect(suggestion?.title).toBe('Approve a command');
    expect(suggestion?.detail).toBe('Implementer wants to run pnpm test');
    expect(suggestion?.band).toBe(0);
  });

  it('suggests signing back in when the last run hit auth_required', () => {
    const suggestions = deriveNextSteps({
      ...BASE_PARAMS,
      agents: [agent({ pendingSignal: { kind: 'auth', providerId: 'anthropic' } })],
    });
    const suggestion = suggestions.find((candidate) => candidate.kind === 'sign-in');
    expect(suggestion?.title).toBe('Sign in to Claude');
    expect(suggestion?.detail).toBe('Implementer stopped: signed out');
  });

  it('suggests unblocking a failed workflow step, ahead of the ready-step suggestion for the same run', () => {
    const suggestions = deriveNextSteps({
      ...BASE_PARAMS,
      workflowRuns: [
        {
          id: 'run-1' as WorkflowRunId,
          title: 'Settlement fix',
          advanceState: { kind: 'ready', stepId: 'step-2' as StepId },
          isRunning: false,
          failedStep: { stepId: 'step-1' as StepId, label: 'Tester' },
        },
      ],
    });
    expect(suggestions.map((candidate) => candidate.kind)).toEqual(['unblock-step']);
    const suggestion = suggestions[0];
    expect(suggestion?.title).toBe('Step failed: Tester');
    expect(suggestion?.band).toBe(0);
  });

  it('suggests retrying the last standalone agent when it failed', () => {
    const suggestions = deriveNextSteps({
      ...BASE_PARAMS,
      agents: [
        agent({ id: 'agent-1' as AgentId, ordinal: 1, status: 'completed' }),
        agent({ id: 'agent-2' as AgentId, ordinal: 2, status: 'failed', label: 'Debugger' }),
      ],
    });
    const suggestion = suggestions.find((candidate) => candidate.kind === 'retry-agent');
    expect(suggestion?.title).toBe('Retry Debugger');
    expect(suggestion?.payload).toEqual({ agentId: 'agent-2', agentKind: 'implementer' });
  });

  it('suggests reviewing the changes when the last standalone implementer finished clean', () => {
    const suggestions = deriveNextSteps({
      ...BASE_PARAMS,
      agents: [agent({ status: 'completed', roleKind: 'implementer' })],
    });
    expect(suggestions.map((candidate) => candidate.kind)).toEqual(['check-changes']);
  });

  it('never suggests both retry and review for the same last agent', () => {
    const retrySuggestions = deriveNextSteps({
      ...BASE_PARAMS,
      agents: [agent({ status: 'failed' })],
    });
    expect(retrySuggestions.some((candidate) => candidate.kind === 'check-changes')).toBe(false);

    const reviewerAlreadyRan = deriveNextSteps({
      ...BASE_PARAMS,
      agents: [
        agent({ id: 'agent-1' as AgentId, ordinal: 1, roleKind: 'implementer' }),
        agent({ id: 'agent-2' as AgentId, ordinal: 2, roleKind: 'reviewer' }),
      ],
    });
    expect(reviewerAlreadyRan.some((candidate) => candidate.kind === 'check-changes')).toBe(false);
  });

  it('leaves a workflow agent out of the standalone retry/review pick', () => {
    const suggestions = deriveNextSteps({
      ...BASE_PARAMS,
      agents: [agent({ status: 'failed', workflowRunId: 'run-1' as WorkflowRunId })],
    });
    expect(suggestions.some((candidate) => candidate.kind === 'retry-agent')).toBe(false);
  });

  it('suggests continuing with the recommended workflow once a standalone scout finishes', () => {
    const suggestions = deriveNextSteps({
      ...BASE_PARAMS,
      agents: [agent({ status: 'completed', roleKind: 'scout', label: 'Scout' })],
      hasGoal: true,
      recommendedWorkflow: { id: 'workflow-1' as WorkflowId, name: 'Plan and ship' },
    });
    const suggestion = suggestions.find((candidate) => candidate.kind === 'continue-with-workflow');
    expect(suggestion?.title).toBe('Continue with a workflow');
    expect(suggestion?.detail).toBe('Plan and ship picks up from what Scout found');
    expect(suggestion?.payload).toEqual({
      workflowId: 'workflow-1',
      workflowName: 'Plan and ship',
    });
  });

  it('suggests continuing with a workflow once a standalone generic agent finishes too', () => {
    const suggestions = deriveNextSteps({
      ...BASE_PARAMS,
      agents: [agent({ status: 'completed', roleKind: 'generic' })],
      hasGoal: true,
      recommendedWorkflow: { id: 'workflow-1' as WorkflowId, name: 'Plan and ship' },
    });
    expect(suggestions.some((candidate) => candidate.kind === 'continue-with-workflow')).toBe(true);
  });

  it('never suggests continuing with a workflow for an implementer, a running workflow, no goal, or no preset', () => {
    const implementerFinished = deriveNextSteps({
      ...BASE_PARAMS,
      agents: [agent({ status: 'completed', roleKind: 'implementer' })],
      hasGoal: true,
      recommendedWorkflow: { id: 'workflow-1' as WorkflowId, name: 'Plan and ship' },
    });
    expect(
      implementerFinished.some((candidate) => candidate.kind === 'continue-with-workflow'),
    ).toBe(false);

    const workflowAlreadyAttached = deriveNextSteps({
      ...BASE_PARAMS,
      agents: [agent({ status: 'completed', roleKind: 'scout' })],
      workflowRuns: [
        {
          id: 'run-1' as WorkflowRunId,
          title: 'Existing run',
          advanceState: { kind: 'blocked' },
          isRunning: false,
        },
      ],
      hasGoal: true,
      recommendedWorkflow: { id: 'workflow-1' as WorkflowId, name: 'Plan and ship' },
    });
    expect(
      workflowAlreadyAttached.some((candidate) => candidate.kind === 'continue-with-workflow'),
    ).toBe(false);

    const noGoal = deriveNextSteps({
      ...BASE_PARAMS,
      agents: [agent({ status: 'completed', roleKind: 'scout' })],
      hasGoal: false,
      recommendedWorkflow: { id: 'workflow-1' as WorkflowId, name: 'Plan and ship' },
    });
    expect(noGoal.some((candidate) => candidate.kind === 'continue-with-workflow')).toBe(false);

    const noPreset = deriveNextSteps({
      ...BASE_PARAMS,
      agents: [agent({ status: 'completed', roleKind: 'scout' })],
      hasGoal: true,
      recommendedWorkflow: null,
    });
    expect(noPreset.some((candidate) => candidate.kind === 'continue-with-workflow')).toBe(false);
  });

  it('suggests fixing failing checks on an open PR', () => {
    const suggestions = deriveNextSteps({
      ...BASE_PARAMS,
      mounts: [mount({ pr: pr({ checks: 'failure' }) })],
    });
    const suggestion = suggestions.find((candidate) => candidate.kind === 'fix-checks');
    expect(suggestion?.title).toBe('Fix failing checks on #618');
  });

  it('suggests marking a green draft PR ready for review', () => {
    const suggestions = deriveNextSteps({
      ...BASE_PARAMS,
      mounts: [mount({ pr: pr({ isDraft: true, checks: 'success' }) })],
    });
    const suggestion = suggestions.find((candidate) => candidate.kind === 'mark-ready');
    expect(suggestion?.title).toBe('Mark #618 ready for review');
  });

  it('suggests merging an approved, green, mergeable PR', () => {
    const suggestions = deriveNextSteps({
      ...BASE_PARAMS,
      mounts: [
        mount({ pr: pr({ reviewDecision: 'approved', checks: 'success', mergeable: true }) }),
      ],
    });
    const suggestion = suggestions.find((candidate) => candidate.kind === 'merge-pr');
    expect(suggestion?.title).toBe('Merge #618');
    expect(suggestion?.payload).toMatchObject({ defaultMethod: 'squash' });
  });

  it('never suggests merging a PR that is not actually mergeable', () => {
    const suggestions = deriveNextSteps({
      ...BASE_PARAMS,
      mounts: [
        mount({ pr: pr({ reviewDecision: 'approved', checks: 'success', mergeable: false }) }),
      ],
    });
    expect(suggestions.some((candidate) => candidate.kind === 'merge-pr')).toBe(false);
  });

  it('suggests opening a pull request once a mount is ahead of base with no PR yet', () => {
    const suggestions = deriveNextSteps({
      ...BASE_PARAMS,
      mounts: [mount({ pr: null, aheadOfBase: 7 })],
    });
    const suggestion = suggestions.find((candidate) => candidate.kind === 'open-pr');
    expect(suggestion?.title).toBe('Open a pull request for web');
    expect(suggestion?.detail).toBe('7 commits ahead');
  });

  it('suggests pushing unpushed commits on a clean worktree', () => {
    const suggestions = deriveNextSteps({
      ...BASE_PARAMS,
      mounts: [mount({ aheadOfUpstream: 4, isClean: true })],
    });
    const suggestion = suggestions.find((candidate) => candidate.kind === 'push-branch');
    expect(suggestion?.title).toBe('Push 4 commits');
  });

  it('never suggests pushing a dirty worktree', () => {
    const suggestions = deriveNextSteps({
      ...BASE_PARAMS,
      mounts: [mount({ aheadOfUpstream: 4, isClean: false })],
    });
    expect(suggestions.some((candidate) => candidate.kind === 'push-branch')).toBe(false);
  });

  it('skips every mount-derived push/PR/merge suggestion while an agent is running', () => {
    const suggestions = deriveNextSteps({
      ...BASE_PARAMS,
      hasRunningAgent: true,
      mounts: [
        mount({ aheadOfUpstream: 4, pr: null, aheadOfBase: 7 }),
        mount({ mountId: 'mount-other' as MountId, pr: pr({ checks: 'failure' }) }),
      ],
    });
    expect(
      suggestions.some((candidate) =>
        ['push-branch', 'open-pr', 'mark-ready', 'merge-pr', 'fix-checks'].includes(candidate.kind),
      ),
    ).toBe(false);
  });

  it('ignores mount data older than five minutes', () => {
    const now = () => Date.parse('2026-01-01T00:10:00.000Z');
    const suggestions = deriveNextSteps({
      ...BASE_PARAMS,
      now,
      mounts: [mount({ aheadOfUpstream: 4, fetchedAt: '2026-01-01T00:00:00.000Z' })],
    });
    expect(suggestions.some((candidate) => candidate.kind === 'push-branch')).toBe(false);
  });

  it('keeps mount data fetched within the last five minutes', () => {
    const now = () => Date.parse('2026-01-01T00:03:00.000Z');
    const suggestions = deriveNextSteps({
      ...BASE_PARAMS,
      now,
      mounts: [mount({ aheadOfUpstream: 4, fetchedAt: '2026-01-01T00:00:00.000Z' })],
    });
    expect(suggestions.some((candidate) => candidate.kind === 'push-branch')).toBe(true);
  });

  it('suggests closing a worktree once its cleanup proposal is pending', () => {
    const suggestions = deriveNextSteps({
      ...BASE_PARAMS,
      cleanupProposals: [cleanupProposal()],
    });
    const suggestion = suggestions.find((candidate) => candidate.kind === 'close-worktree');
    expect(suggestion?.title).toBe('Close the web worktree');
    expect(suggestion?.detail).toBe('#612 merged');
  });
});

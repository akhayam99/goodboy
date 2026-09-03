import { describe, expect, it } from 'vitest';
import type { PlanId, ProjectId, SessionId, StepId, WorkflowRunId } from '@goodboy/types';
import { deriveSessionSuggestions } from './deriveSessionSuggestions';

const sessionId = 'session-1' as SessionId;
const planId = 'plan-1' as PlanId;

const derive = ({
  openQuestionCount = 0,
  isRunning = false,
  creatorHasOpenQuestions = false,
  consumedPlanIds = new Set<PlanId>(),
  hasPullRequest = false,
  threads = [],
  mainDistance = null,
}: {
  openQuestionCount?: number;
  isRunning?: boolean;
  creatorHasOpenQuestions?: boolean;
  consumedPlanIds?: ReadonlySet<PlanId>;
  hasPullRequest?: boolean;
  threads?: ReadonlyArray<{
    readonly source: string;
    readonly resolved: boolean;
    readonly isPendingResolution: boolean;
    readonly resolverStatus: string | null;
  }>;
  mainDistance?: number | null;
}) =>
  deriveSessionSuggestions({
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
    threads,
    projects: [
      {
        projectId: 'project-1' as ProjectId,
        projectName: 'Goodboy',
        worktreePath: '/tmp/goodboy',
        baseBranch: 'main',
        mainDistance,
      },
    ],
  });

describe('deriveSessionSuggestions', () => {
  it('ranks all suggestion kinds', () => {
    const suggestions = derive({
      openQuestionCount: 2,
      hasPullRequest: true,
      threads: [
        {
          source: 'review',
          resolved: false,
          isPendingResolution: false,
          resolverStatus: null,
        },
      ],
      mainDistance: 3,
    });
    expect(suggestions.map((suggestion) => suggestion.kind)).toEqual([
      'answer-questions',
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

  it('excludes pending resolution and includes failed resolvers', () => {
    const suggestions = derive({
      hasPullRequest: true,
      threads: [
        { source: 'review', resolved: false, isPendingResolution: true, resolverStatus: null },
        {
          source: 'review',
          resolved: false,
          isPendingResolution: false,
          resolverStatus: 'running',
        },
        { source: 'review', resolved: false, isPendingResolution: false, resolverStatus: 'failed' },
      ],
    });
    expect(
      suggestions.find((suggestion) => suggestion.kind === 'resolve-threads')?.payload,
    ).toEqual({ eligibleThreadCount: 1 });
  });

  it('orders equal-priority suggestions by id', () => {
    const suggestions = deriveSessionSuggestions({
      sessionId,
      workflowRuns: [],
      plans: [],
      consumedPlanIds: new Set<PlanId>(),
      openQuestionCount: 0,
      hasPullRequest: false,
      threads: [],
      projects: [
        {
          projectId: 'project-z' as ProjectId,
          projectName: 'Zulu',
          worktreePath: '/tmp/zulu',
          baseBranch: 'main',
          mainDistance: 1,
        },
        {
          projectId: 'project-a' as ProjectId,
          projectName: 'Alpha',
          worktreePath: '/tmp/alpha',
          baseBranch: 'main',
          mainDistance: 1,
        },
      ],
    });

    expect(suggestions.map((suggestion) => suggestion.id)).toEqual([
      'rebase-project:project-a',
      'rebase-project:project-z',
    ]);
  });
});

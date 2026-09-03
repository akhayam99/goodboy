import type { PlanId, ProjectId, SessionId, StepId, WorkflowRunId } from '@goodboy/types';
import type { SessionSuggestion } from './types';

export type SuggestionWorkflowRun = {
  readonly id: WorkflowRunId;
  readonly title: string;
  readonly advanceState: { readonly kind: string; readonly stepId?: StepId };
  readonly isRunning: boolean;
};

export type SuggestionPlan = {
  readonly id: PlanId;
  readonly title: string;
  readonly status: string;
  readonly creatorHasOpenQuestions: boolean;
};

export type SuggestionThread = {
  readonly source: string;
  readonly resolved: boolean;
  readonly isPendingResolution: boolean;
  readonly resolverStatus: string | null;
};

export type SuggestionProject = {
  readonly projectId: ProjectId;
  readonly projectName: string;
  readonly worktreePath: string;
  readonly baseBranch: string;
  readonly mainDistance: number | null;
};

type Params = {
  readonly sessionId: SessionId;
  readonly workflowRuns: ReadonlyArray<SuggestionWorkflowRun>;
  readonly plans: ReadonlyArray<SuggestionPlan>;
  readonly consumedPlanIds: ReadonlySet<PlanId>;
  readonly openQuestionCount: number;
  readonly hasPullRequest: boolean;
  readonly threads: ReadonlyArray<SuggestionThread>;
  readonly projects: ReadonlyArray<SuggestionProject>;
};

export const deriveSessionSuggestions = ({
  sessionId,
  workflowRuns,
  plans,
  consumedPlanIds,
  openQuestionCount,
  hasPullRequest,
  threads,
  projects,
}: Params): ReadonlyArray<SessionSuggestion> => {
  const suggestions: SessionSuggestion[] = [];
  if (openQuestionCount > 0) {
    suggestions.push({
      id: `answer-questions:${sessionId}`,
      kind: 'answer-questions',
      priority: 0,
      title: 'Answer open questions',
      detail: `${openQuestionCount} ${openQuestionCount === 1 ? 'question' : 'questions'} blocking progress`,
      sessionId,
      payload: { count: openQuestionCount },
    });
  }
  for (const run of workflowRuns) {
    if (run.advanceState.kind !== 'ready' || run.advanceState.stepId == null) {
      continue;
    }
    suggestions.push({
      id: `workflow-next-step:${run.id}`,
      kind: 'workflow-next-step',
      priority: 10,
      title: `Continue ${run.title}`,
      sessionId,
      payload: { runId: run.id, stepId: run.advanceState.stepId },
    });
  }
  const activePlan = [...plans].reverse().find((plan) => plan.status === 'active') ?? null;
  const hasRunningWorkflow = workflowRuns.some((run) => run.isRunning);
  if (
    activePlan != null &&
    !activePlan.creatorHasOpenQuestions &&
    !consumedPlanIds.has(activePlan.id) &&
    !hasRunningWorkflow
  ) {
    suggestions.push({
      id: `plan-ready:${activePlan.id}`,
      kind: 'plan-ready',
      priority: 20,
      title: activePlan.title,
      detail: 'Ready to implement',
      sessionId,
      payload: { planId: activePlan.id },
    });
  }
  const eligibleThreadCount = threads.filter(
    (thread) =>
      thread.source === 'review' &&
      !thread.resolved &&
      !thread.isPendingResolution &&
      (thread.resolverStatus == null || thread.resolverStatus === 'failed'),
  ).length;
  if (hasPullRequest && eligibleThreadCount > 0) {
    suggestions.push({
      id: `resolve-threads:${sessionId}`,
      kind: 'resolve-threads',
      priority: 30,
      title: 'Resolve review comments',
      detail: `${eligibleThreadCount} ${eligibleThreadCount === 1 ? 'comment' : 'comments'}`,
      sessionId,
      payload: { eligibleThreadCount },
    });
  }
  for (const project of projects) {
    if (project.mainDistance == null || project.mainDistance <= 0) {
      continue;
    }
    suggestions.push({
      id: `rebase-project:${project.projectId}`,
      kind: 'rebase-project',
      priority: 40,
      title: `Rebase ${project.projectName} on ${project.baseBranch}`,
      detail: `${project.mainDistance} behind`,
      sessionId,
      payload: {
        projectId: project.projectId,
        worktreePath: project.worktreePath,
        baseBranch: project.baseBranch,
        behind: project.mainDistance,
      },
    });
  }
  return suggestions.sort(
    (first, second) => first.priority - second.priority || first.id.localeCompare(second.id),
  );
};

import type { PlanId, ProjectId, SessionId, StepId, WorkflowRunId } from '@goodboy/types';

export type SuggestionKind =
  'workflow-next-step' | 'plan-ready' | 'resolve-threads' | 'rebase-project' | 'answer-questions';

type SuggestionBase = {
  readonly id: string;
  readonly priority: number;
  readonly title: string;
  readonly detail?: string;
  readonly sessionId: SessionId;
};

export type SessionSuggestion =
  | (SuggestionBase & {
      readonly kind: 'workflow-next-step';
      readonly payload: { readonly runId: WorkflowRunId; readonly stepId: StepId };
    })
  | (SuggestionBase & {
      readonly kind: 'plan-ready';
      readonly payload: { readonly planId: PlanId };
    })
  | (SuggestionBase & {
      readonly kind: 'resolve-threads';
      readonly payload: { readonly eligibleThreadCount: number };
    })
  | (SuggestionBase & {
      readonly kind: 'rebase-project';
      readonly payload: {
        readonly projectId: ProjectId;
        readonly worktreePath: string;
        readonly baseBranch: string;
        readonly behind: number;
      };
    })
  | (SuggestionBase & {
      readonly kind: 'answer-questions';
      readonly payload: { readonly count: number };
    });

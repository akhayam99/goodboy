import type {
  AgentId,
  MountId,
  PlanId,
  PrMergeMethod,
  ProjectId,
  ProviderId,
  SessionEventId,
  SessionId,
  StepId,
  WorkflowId,
  WorkflowRunId,
} from '@goodboy/types';
import type { AgentKind } from '../session/agent-kind';

export const SUGGESTION_KINDS = [
  'workflow-next-step',
  'plan-ready',
  'resolve-threads',
  'rebase-project',
  'answer-questions',
  'mount-project',
  'approve-tool',
  'sign-in',
  'unblock-step',
  'retry-agent',
  'fix-checks',
  'push-branch',
  'open-pr',
  'mark-ready',
  'merge-pr',
  'check-changes',
  'close-worktree',
  'continue-with-workflow',
] as const;

export type SuggestionKind = (typeof SUGGESTION_KINDS)[number];

export type NextStepBand = 0 | 1 | 2 | 3;

type SuggestionBase = {
  readonly id: string;
  readonly priority: number;
  readonly title: string;
  readonly detail?: string;
  readonly sessionId: SessionId;
  readonly band: NextStepBand;
  readonly fingerprint: string;
  readonly targetKey: string | null;
};

export type RebaseSuggestionTarget = {
  readonly id: string;
  readonly mountId: MountId;
  readonly projectId: ProjectId;
  readonly projectName: string;
  readonly branch: string;
  readonly worktreePath: string;
  readonly baseBranch: string;
  readonly behind: number;
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
        readonly targets: ReadonlyArray<RebaseSuggestionTarget>;
      };
    })
  | (SuggestionBase & {
      readonly kind: 'answer-questions';
      readonly payload: { readonly count: number };
    })
  | (SuggestionBase & {
      readonly kind: 'mount-project';
      readonly payload: {
        readonly projectId: ProjectId;
        readonly projectName: string;
        readonly reason: string;
        readonly agentId: AgentId | null;
        readonly eventId: SessionEventId;
      };
    })
  | (SuggestionBase & {
      readonly kind: 'approve-tool';
      readonly payload: {
        readonly agentId: AgentId;
        readonly agentLabel: string;
        readonly toolUseId: string;
        readonly toolName: string;
      };
    })
  | (SuggestionBase & {
      readonly kind: 'sign-in';
      readonly payload: {
        readonly agentId: AgentId;
        readonly agentLabel: string;
        readonly providerId: ProviderId;
      };
    })
  | (SuggestionBase & {
      readonly kind: 'unblock-step';
      readonly payload: {
        readonly runId: WorkflowRunId;
        readonly stepId: StepId;
        readonly stepLabel: string | null;
      };
    })
  | (SuggestionBase & {
      readonly kind: 'retry-agent';
      readonly payload: { readonly agentId: AgentId; readonly agentKind: AgentKind };
    })
  | (SuggestionBase & {
      readonly kind: 'fix-checks';
      readonly payload: {
        readonly mountId: MountId;
        readonly projectName: string;
        readonly prNumber: number;
      };
    })
  | (SuggestionBase & {
      readonly kind: 'push-branch';
      readonly payload: {
        readonly mountId: MountId;
        readonly projectId: ProjectId;
        readonly projectName: string;
        readonly branch: string;
        readonly worktreePath: string;
        readonly ahead: number;
      };
    })
  | (SuggestionBase & {
      readonly kind: 'open-pr';
      readonly payload: {
        readonly mountId: MountId;
        readonly projectId: ProjectId;
        readonly projectName: string;
        readonly ahead: number;
      };
    })
  | (SuggestionBase & {
      readonly kind: 'mark-ready';
      readonly payload: {
        readonly mountId: MountId;
        readonly projectName: string;
        readonly prNumber: number;
      };
    })
  | (SuggestionBase & {
      readonly kind: 'merge-pr';
      readonly payload: {
        readonly mountId: MountId;
        readonly projectName: string;
        readonly prNumber: number;
        readonly defaultMethod: PrMergeMethod;
      };
    })
  | (SuggestionBase & {
      readonly kind: 'check-changes';
      readonly payload: { readonly agentId: AgentId };
    })
  | (SuggestionBase & {
      readonly kind: 'close-worktree';
      readonly payload: {
        readonly mountId: MountId;
        readonly requestId: string;
        readonly branch: string;
        readonly prNumber: number | null;
      };
    })
  | (SuggestionBase & {
      readonly kind: 'continue-with-workflow';
      readonly payload: { readonly workflowId: WorkflowId; readonly workflowName: string };
    });

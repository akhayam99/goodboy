import type {
  AgentId,
  MountId,
  OpenQuestionId,
  PlanId,
  PrMergeMethod,
  PrSeriesId,
  ProjectId,
  ProviderId,
  SessionEventId,
  SessionId,
  StepId,
  WorkflowId,
  WorkflowRunId,
} from '@goodboy/types';
import type { CheckChainState } from '../../store/slices/agents/selectCheckChain';
import type { TrackerMove } from '../../store/slices/tracker-moves/types';
import type { CheckOutcome } from '../branch/checks/checkOutcomeOf';
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
  'retry-agent',
  'resume-agents',
  'fix-checks',
  'push-branch',
  'open-pr',
  'mark-ready',
  'merge-pr',
  'merge-series',
  'check-changes',
  'move-tracker-item',
  'close-worktree',
  'archive-session',
  'continue-with-workflow',
  'run-failing-test',
  'next-script',
  'rerun-check',
  'unmount-folder',
  'ask-agent',
] as const;

export type NextScriptRule = 'migrations' | 'lockfile' | 'schema';

export type SuggestionKind = (typeof SUGGESTION_KINDS)[number];

export type FixChecksProgress = {
  readonly chain: CheckChainState;
  readonly checkName: string;
  readonly commit: string | null;
  readonly commitCount: number;
  readonly outcome: CheckOutcome | null;
};

export type ScribeRequestState = 'writing' | 'ready' | 'creating';

export type SuggestionQuestion = {
  readonly id: OpenQuestionId;
  readonly createdByAgentId: AgentId | null;
};

export type NextStepBand = 0 | 1 | 2 | 3;

export type MoveGroup = 'unblock' | 'advance' | 'upkeep';

export type MoveTool =
  | 'workflow'
  | 'plans'
  | 'questions'
  | 'review'
  | 'chat'
  | 'agent'
  | 'mounts'
  | 'branch'
  | 'checks'
  | 'scripts'
  | 'terminal'
  | 'tracker'
  | 'session';

export type MovePlace = {
  readonly tool: MoveTool;
  readonly mountId: MountId | null;
  readonly agentId: AgentId | null;
};

export type CompletesWhen =
  | {
      readonly kind: 'check-passes';
      readonly mountId: MountId;
      readonly checkName: string;
    }
  | {
      readonly kind: 'script-succeeds';
      readonly mountId: MountId | null;
      readonly scriptName: string;
    }
  | { readonly kind: 'folder-mounted'; readonly projectId: ProjectId }
  | { readonly kind: 'folder-unmounted'; readonly mountId: MountId }
  | { readonly kind: 'worktree-removed'; readonly mountId: MountId }
  | { readonly kind: 'agent-answers'; readonly agentId: AgentId }
  | { readonly kind: 'pr-merged'; readonly mountId: MountId }
  | { readonly kind: 'rebase-finished'; readonly mountId: MountId }
  | { readonly kind: 'move-gone' };

export type MoveEvidence =
  | { readonly kind: 'log'; readonly label: string; readonly lines: ReadonlyArray<string> }
  | { readonly kind: 'files'; readonly label: string; readonly paths: ReadonlyArray<string> }
  | { readonly kind: 'quiet'; readonly label: string; readonly quietMs: number }
  | { readonly kind: 'command'; readonly label: string; readonly command: string }
  | { readonly kind: 'link'; readonly label: string; readonly url: string };

export type MoveCommand = {
  readonly text: string;
  readonly cwd: string;
  readonly mode: 'run' | 'type';
  readonly scriptId: string | null;
};

export type MoveRead = {
  readonly state: 'fresh' | 'stale' | 'unread';
  readonly fetchedAt: string | null;
};

export type MoveFacts = {
  readonly reason: string;
  readonly evidence: ReadonlyArray<MoveEvidence>;
  readonly place: MovePlace;
  readonly completesWhen: CompletesWhen;
  readonly group: MoveGroup;
  readonly read: MoveRead | null;
};

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

type CleanupWorktree = {
  readonly mountId: MountId;
  readonly requestId: string;
  readonly branch: string;
  readonly prNumber: number | null;
  readonly reason?: 'merge_cleanup' | 'unmount';
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
  readonly dirtyCount: number;
  readonly conflictCount?: number;
};

export type OpenPrTarget = {
  readonly mountId: MountId;
  readonly projectId: ProjectId;
  readonly projectName: string;
  readonly branch: string;
  readonly worktreePath: string;
  readonly ahead: number;
  readonly scribe: ScribeRequestState | null;
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
      readonly payload: {
        readonly count: number;
        readonly firstQuestion: SuggestionQuestion | null;
        readonly rootAgentId: AgentId | null;
      };
    })
  | (SuggestionBase & {
      readonly kind: 'mount-project';
      readonly payload: {
        readonly projectId: ProjectId;
        readonly projectName: string;
        readonly reason: string;
        readonly agentId: AgentId | null;
        readonly eventId: SessionEventId;
        readonly askCount?: number;
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
      readonly kind: 'retry-agent';
      readonly payload: { readonly agentId: AgentId; readonly agentKind: AgentKind };
    })
  | (SuggestionBase & {
      readonly kind: 'resume-agents';
      readonly payload: { readonly agentIds: ReadonlyArray<AgentId> };
    })
  | (SuggestionBase & {
      readonly kind: 'fix-checks';
      readonly payload: {
        readonly mountId: MountId;
        readonly projectName: string;
        readonly prNumber: number;
        readonly progress?: FixChecksProgress;
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
        readonly state: 'ahead' | 'not-pushed' | 'diverged';
        readonly ahead: number;
        readonly behind: number;
      };
    })
  | (SuggestionBase & {
      readonly kind: 'open-pr';
      readonly payload: OpenPrTarget & {
        readonly targets: ReadonlyArray<OpenPrTarget>;
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
      readonly kind: 'merge-series';
      readonly payload: {
        readonly seriesId: PrSeriesId;
        readonly name: string;
        readonly labels: ReadonlyArray<string>;
      };
    })
  | (SuggestionBase & {
      readonly kind: 'check-changes';
      readonly payload: { readonly agentId: AgentId };
    })
  | (SuggestionBase & {
      readonly kind: 'move-tracker-item';
      readonly payload: { readonly move: TrackerMove };
    })
  | (SuggestionBase & {
      readonly kind: 'close-worktree';
      readonly payload: {
        readonly worktrees: ReadonlyArray<CleanupWorktree>;
      };
    })
  | (SuggestionBase & {
      readonly kind: 'archive-session';
      readonly payload: { readonly branchCount: number };
    })
  | (SuggestionBase & {
      readonly kind: 'continue-with-workflow';
      readonly payload: { readonly workflowId: WorkflowId; readonly workflowName: string };
    })
  | (SuggestionBase & {
      readonly kind: 'run-failing-test';
      readonly payload: {
        readonly mountId: MountId;
        readonly prNumber: number;
        readonly checkName: string;
        readonly testName: string;
        readonly command: MoveCommand;
      };
    })
  | (SuggestionBase & {
      readonly kind: 'next-script';
      readonly payload: {
        readonly mountId: MountId;
        readonly scriptName: string;
        readonly rule: NextScriptRule;
        readonly command: MoveCommand;
      };
    })
  | (SuggestionBase & {
      readonly kind: 'rerun-check';
      readonly payload: {
        readonly mountId: MountId;
        readonly prNumber: number;
        readonly checkName: string;
        readonly runId: string;
        readonly cwd: string;
      };
    })
  | (SuggestionBase & {
      readonly kind: 'unmount-folder';
      readonly payload: {
        readonly mountId: MountId;
        readonly projectId: ProjectId;
        readonly projectName: string;
        readonly idleDays: number;
      };
    })
  | (SuggestionBase & {
      readonly kind: 'ask-agent';
      readonly payload: {
        readonly agentId: AgentId;
        readonly agentLabel: string;
        readonly quietMs: number;
      };
    });

export type NextMove = SessionSuggestion & MoveFacts;

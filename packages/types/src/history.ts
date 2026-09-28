import type { MountId, SessionId } from './ids';

export const HISTORY_VERBS = ['pick', 'reword', 'squash', 'fixup', 'drop'] as const;

export type HistoryVerb = (typeof HISTORY_VERBS)[number];

export type HistoryStep = {
  readonly sha: string;
  readonly verb: HistoryVerb;
  readonly message?: string | null;
  readonly target?: string | null;
};

export type HistoryPlanArgs = {
  readonly worktreePath: string;
  readonly base: string;
  readonly head: string;
  readonly steps: ReadonlyArray<HistoryStep>;
  readonly onto?: string | null;
};

export type HistoryStepOutcome = 'clean' | 'conflict' | 'empty' | 'dropped' | 'blocked';

export type HistoryStepPrediction = {
  readonly sha: string;
  readonly outcome: HistoryStepOutcome;
  readonly files: ReadonlyArray<string>;
  readonly newSha: string | null;
};

export type HistoryPlanPrediction = {
  readonly isSupported: boolean;
  readonly steps: ReadonlyArray<HistoryStepPrediction>;
  readonly head: string | null;
  readonly isTreeEqual: boolean;
  readonly changedFiles: ReadonlyArray<string>;
};

export type HistoryShaMove = {
  readonly from: string;
  readonly to: string | null;
};

export type HistoryStopKind = 'merge' | 'hook';

export type HistoryTrialStop = {
  readonly sha: string;
  readonly index: number;
  readonly kind: HistoryStopKind;
  readonly files: ReadonlyArray<string>;
  readonly message: string;
};

export type HistoryPlannedStep = {
  readonly sha: string;
  readonly verb: HistoryVerb;
  readonly message: string;
};

export type HistoryTrialResult = {
  readonly head: string | null;
  readonly map: ReadonlyArray<HistoryShaMove>;
  readonly isTreeEqual: boolean;
  readonly changedFiles: ReadonlyArray<string>;
  readonly stop: HistoryTrialStop | null;
  readonly copyPath: string | null;
  readonly order: ReadonlyArray<HistoryPlannedStep>;
  readonly check: HistoryTrialCheck | null;
};

export type HistoryTrialCheck = {
  readonly isPassed: boolean;
  readonly expectsSameCode: boolean;
  readonly problems: ReadonlyArray<string>;
  readonly unexpectedFiles: ReadonlyArray<string>;
  readonly removedFiles: ReadonlyArray<string>;
};

export type HistoryTrialProgress =
  | { readonly stage: 'copy' }
  | {
      readonly stage: 'step';
      readonly index: number;
      readonly total: number;
      readonly sha: string;
    }
  | { readonly stage: 'check' }
  | { readonly stage: 'cleanup' };

export type HistoryRunOutcome =
  | { readonly kind: 'blocked'; readonly reason: string }
  | { readonly kind: 'tried'; readonly result: HistoryTrialResult };

export type HistoryGraphCommit = {
  readonly sha: string;
  readonly subject: string;
  readonly author: string;
  readonly timestamp: number;
};

export type HistoryCommitFiles = {
  readonly sha: string;
  readonly files: ReadonlyArray<string>;
};

export type HistoryGraph = {
  readonly baseRef: string;
  readonly mergeBase: HistoryGraphCommit;
  readonly mainHead: string;
  readonly mainCommits: ReadonlyArray<HistoryGraphCommit>;
  readonly behind: number;
  readonly remoteSha: string | null;
  readonly files: ReadonlyArray<HistoryCommitFiles>;
};

export type HistoryRebaseCommit = {
  readonly sha: string;
  readonly subject: string;
};

export type HistoryRebasePlan = {
  readonly onto: string;
  readonly ontoRef: string;
  readonly mergeBase: string;
  readonly head: string;
  readonly commits: ReadonlyArray<HistoryRebaseCommit>;
  readonly behind: number;
  readonly fetchError: string | null;
};

export type HistoryOriginAhead = {
  readonly remoteSha: string;
  readonly commits: ReadonlyArray<HistoryRebaseCommit>;
  readonly fetchError: string | null;
};

export type HistoryRewriterCheck = {
  readonly head: string | null;
  readonly map: ReadonlyArray<HistoryShaMove>;
  readonly problems: ReadonlyArray<string>;
  readonly isTreeEqual: boolean;
  readonly changedFiles: ReadonlyArray<string>;
};

export type HistoryMoveOutcome =
  | { readonly kind: 'moved'; readonly head: string; readonly backupRef: string }
  | { readonly kind: 'busy'; readonly holder: string | null }
  | { readonly kind: 'head-moved'; readonly head: string }
  | { readonly kind: 'blocked'; readonly reason: string };

export type HistoryBackup = {
  readonly refName: string;
  readonly sha: string;
  readonly subject: string;
  readonly createdAt: number;
};

export type LeasePushOutcome =
  | { readonly kind: 'pushed' }
  | { readonly kind: 'stale'; readonly message: string }
  | { readonly kind: 'failed'; readonly message: string };

export const HISTORY_PLAN_STATES = ['draft', 'applied', 'pushed', 'discarded'] as const;

export type HistoryPlanState = (typeof HISTORY_PLAN_STATES)[number];

export type HistoryPlan = {
  readonly id: string;
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly branch: string;
  readonly baseSha: string;
  readonly headSha: string;
  readonly items: ReadonlyArray<HistoryStep>;
  readonly state: HistoryPlanState;
  readonly backupRef: string | null;
  readonly remoteShaAtApply: string | null;
  readonly appliedAt: number | null;
  readonly pushedAt: number | null;
  readonly createdAt: number;
  readonly updatedAt: number;
};

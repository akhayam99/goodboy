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

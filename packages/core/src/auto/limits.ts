import { FAN_OUT_MAX_CHILDREN } from '../roles';

export const AUTO_GATES = { isDelegationEnabled: true } as const;

export const AUTO_TURN_CEILING_USD = 0.5;

export const AUTO_DELEGATION_DEADLINE_MINUTES = 30;

export const AUTO_CHILD_IDLE_MINUTES = 30;

export const AUTO_STALE_DECIDE_MS = 10 * 60 * 1000;

export const AUTO_BATCH_MIN_CHILDREN = 1;

export const AUTO_BATCH_MAX_CHILDREN = FAN_OUT_MAX_CHILDREN;

export const AUTO_TREE_DEPTH = 2;

export const AUTO_SUBSTEPS_PER_PARENT = 2;

export const AUTO_SUBSTEP_PARENT_SLACK_MS = 5 * 60_000;

export const AUTO_TREE_LIMITS = {
  delegateCallsPerTurn: 6,
  refusals: 10,
  questionCyclesPerDelegation: 3,
  noProgressStreak: 3,
  wallClockHours: 24,
} as const;

export const AUTO_MAX_OPEN_CHILDREN = AUTO_BATCH_MAX_CHILDREN;

export const AUTO_AUX_RESERVATION_USD = 0.05;

export const AUTO_OWNER_LEASE_MS = 30_000;

export const AUTO_OUTBOX_CLAIM_MS = 60_000;

export const AUTO_LEDGER_MAX_ARTIFACTS = 20;

export const AUTO_LEDGER_CHAR_BUDGET = 3_000;

export const AUTO_LEDGER_OUTLINE_CHARS = 400;

export const AUTO_DELIVERY_ARTIFACT_CHARS = 6_000;

export const AUTO_DELIVERY_ARTIFACTS_TOTAL_CHARS = 24_000;

export const AUTO_DIGEST_SETTLED_MAX = 12;

export const AUTO_DIGEST_TASK_CHARS = 160;

export const AUTO_REVISE_ASK_CHARS = 240;

export const AUTO_BRIEF_VERSION = 2;

export const AUTO_BRIEF_DECISION_CHARS = 600;

export const AUTO_FACTS_MOUNTS_MAX = 4;

export const AUTO_FACTS_CHARS = 6_000;

export const AUTO_FACTS_FETCH_MS = 30_000;

export const AUTO_FACTS_COMMITS_MAX = 30;

export const AUTO_FACTS_THREADS_MAX = 20;

export const AUTO_FACTS_CHECKS_MAX = 30;

export const AUTO_FACTS_THREAD_CHARS = 240;

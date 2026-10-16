import { FAN_OUT_MAX_CHILDREN } from '../roles';
import type { AutoDelegationRole } from './roles';

export const AUTO_GATES = { isDelegationEnabled: true } as const;

export const AUTO_ATTEMPT_CEILING_USD = {
  scout: 0.5,
  planner: 0.75,
  reviewer: 0.75,
  investigator: 1.5,
  docs: 0.5,
  tester: 1.5,
  implementer: 3,
  scribe: 0.5,
  'ci-fixer': 1.5,
  rewriter: 1.5,
} as const satisfies Readonly<Record<AutoDelegationRole, number>>;

export const AUTO_TURN_CEILING_USD = 0.5;

export const AUTO_DEFAULT_TREE_CAP_USD = 5;

export const AUTO_DELEGATION_DEADLINE_MINUTES = 30;

export const AUTO_BATCH_MIN_CHILDREN = 1;

export const AUTO_BATCH_MAX_CHILDREN = FAN_OUT_MAX_CHILDREN;

export const AUTO_TREE_DEPTH = 1;

export const AUTO_TREE_LIMITS = {
  autoTurns: 30,
  delegations: 12,
  attempts: 20,
  delegateCallsPerTurn: 6,
  refusals: 10,
  questionCyclesPerDelegation: 3,
  noProgressStreak: 3,
  wallClockHours: 24,
} as const;

export type AutoTreeLimitKey = keyof typeof AUTO_TREE_LIMITS;

export const AUTO_GRANT_ALLOWANCE = {
  autoTurns: 6,
  delegations: 4,
  attempts: 4,
} as const;

export const AUTO_MAX_GRANTS_PER_TREE = 3;

type AttemptCeilingParams = {
  readonly role: AutoDelegationRole;
  readonly remainingUsd: number;
};

export const attemptCeilingUsd = ({ role, remainingUsd }: AttemptCeilingParams): number =>
  Math.max(0, Math.min(AUTO_ATTEMPT_CEILING_USD[role], remainingUsd));

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

export type AutoEffectiveLimits = {
  readonly autoTurns: number;
  readonly delegations: number;
  readonly attempts: number;
  readonly delegateCallsPerTurn: number;
  readonly refusals: number;
  readonly questionCyclesPerDelegation: number;
  readonly noProgressStreak: number;
};

type EffectiveLimitsParams = {
  readonly grants: number;
};

export const effectiveTreeLimits = ({ grants }: EffectiveLimitsParams): AutoEffectiveLimits => ({
  autoTurns: AUTO_TREE_LIMITS.autoTurns + grants * AUTO_GRANT_ALLOWANCE.autoTurns,
  delegations: AUTO_TREE_LIMITS.delegations + grants * AUTO_GRANT_ALLOWANCE.delegations,
  attempts: AUTO_TREE_LIMITS.attempts + grants * AUTO_GRANT_ALLOWANCE.attempts,
  delegateCallsPerTurn: AUTO_TREE_LIMITS.delegateCallsPerTurn,
  refusals: AUTO_TREE_LIMITS.refusals,
  questionCyclesPerDelegation: AUTO_TREE_LIMITS.questionCyclesPerDelegation,
  noProgressStreak: AUTO_TREE_LIMITS.noProgressStreak,
});

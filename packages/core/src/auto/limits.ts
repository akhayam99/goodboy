import { FAN_OUT_MAX_CHILDREN } from '../roles';
import type { AutoDelegationRole } from './roles';

export const AUTO_GATES = { isDelegationEnabled: false } as const;

export const AUTO_ATTEMPT_CEILING_USD = {
  scout: 0.5,
  planner: 0.75,
  reviewer: 0.75,
  investigator: 1.5,
  docs: 0.5,
  tester: 1.5,
  implementer: 3,
} as const satisfies Readonly<Record<AutoDelegationRole, number>>;

export const AUTO_TURN_CEILING_USD = 0.5;

export const AUTO_DEFAULT_TREE_CAP_USD = 5;

export const AUTO_DELEGATION_DEADLINE_MINUTES = 30;

export const AUTO_YIELD_GRACE_SECONDS = 20;

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

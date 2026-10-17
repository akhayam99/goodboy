import { AUTO_TURN_CEILING_USD, effectiveTreeLimits } from './limits';

export const AUTO_BLOCK_REASONS = [
  'limit_turns',
  'limit_no_progress',
  'limit_wall_clock',
  'budget',
] as const;

export type AutoBlockReason = (typeof AUTO_BLOCK_REASONS)[number];

export const AUTO_BLOCK_TEXT = {
  limit_turns:
    'Auto used all the turns it may take in this conversation. Retry to allow a few more.',
  limit_no_progress:
    'Auto answered three times in a row without handing work over or saying anything. Retry to try again.',
  limit_wall_clock: 'This conversation reached its time limit.',
  budget: 'The budget left does not cover another Auto turn. Raise the limit to go on.',
} as const satisfies Readonly<Record<AutoBlockReason, string>>;

export const AUTO_STALE_DECIDE_TEXT =
  'Auto stopped answering before it replied. Retry to send the message again.';

export type TurnGateParams = Readonly<{
  turnsUsed: number;
  grants: number;
  noProgressStreak: number;
  hardDeadlineAt: number;
  nowMs: number;
  remainingUsd: number;
}>;

export const turnGate = ({
  turnsUsed,
  grants,
  noProgressStreak,
  hardDeadlineAt,
  nowMs,
  remainingUsd,
}: TurnGateParams): AutoBlockReason | null => {
  const limits = effectiveTreeLimits({ grants });
  if (nowMs >= hardDeadlineAt) {
    return 'limit_wall_clock';
  }
  if (turnsUsed >= limits.autoTurns) {
    return 'limit_turns';
  }
  if (noProgressStreak >= limits.noProgressStreak) {
    return 'limit_no_progress';
  }
  if (remainingUsd + 1e-9 < AUTO_TURN_CEILING_USD) {
    return 'budget';
  }
  return null;
};

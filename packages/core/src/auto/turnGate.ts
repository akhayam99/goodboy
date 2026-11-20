import { AUTO_RETURNS_WINDOW_MS, AUTO_TREE_LIMITS, AUTO_TURN_CEILING_USD } from './limits';

export const AUTO_BLOCK_REASONS = ['limit_no_progress', 'budget', 'limit_returns'] as const;

export type AutoBlockReason = (typeof AUTO_BLOCK_REASONS)[number];

export const AUTO_BLOCK_TEXT = {
  limit_no_progress: `The Lead replied ${AUTO_TREE_LIMITS.noProgressStreak} times with no next step.`,
  budget: 'The run reached its limit.',
  limit_returns: `Agents came back to the Lead ${AUTO_TREE_LIMITS.returnsPerTreeWindow} times in ${AUTO_RETURNS_WINDOW_MS / 60_000} minutes with no limit set.`,
} as const satisfies Readonly<Record<AutoBlockReason, string>>;

export const AUTO_STALE_DECIDE_TEXT =
  'The Lead stopped answering before it replied. Retry sends your message again.';

export type TurnGateParams = Readonly<{
  noProgressStreak: number;
  remainingUsd: number;
}>;

export const turnGate = ({
  noProgressStreak,
  remainingUsd,
}: TurnGateParams): AutoBlockReason | null => {
  if (noProgressStreak >= AUTO_TREE_LIMITS.noProgressStreak) {
    return 'limit_no_progress';
  }
  if (remainingUsd + 1e-9 < AUTO_TURN_CEILING_USD) {
    return 'budget';
  }
  return null;
};

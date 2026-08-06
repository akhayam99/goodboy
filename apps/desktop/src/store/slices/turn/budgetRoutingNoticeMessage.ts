import type { ProviderId, RoutingReason } from '@goodboy/types';

export type BudgetRoutingReason = Extract<RoutingReason, 'fallback-budget' | 'fallback-threshold'>;

type Params = {
  readonly from: ProviderId;
  readonly to: ProviderId;
  readonly reason: BudgetRoutingReason;
};

const causeFor = ({ reason }: { readonly reason: BudgetRoutingReason }): string => {
  switch (reason) {
    case 'fallback-threshold':
      return 'is past its budget threshold';
    case 'fallback-budget':
      return 'is over its monthly cap';
    default: {
      const exhaustive: never = reason;
      throw new Error(`unknown budget routing reason: ${String(exhaustive)}`);
    }
  }
};

export const budgetRoutingReason = ({
  reason,
}: {
  readonly reason: RoutingReason;
}): BudgetRoutingReason | null => {
  if (reason === 'fallback-budget' || reason === 'fallback-threshold') {
    return reason;
  }
  return null;
};

export const budgetRoutingNoticeMessage = ({ from, to, reason }: Params): string =>
  `${from} ${causeFor({ reason })}. running this turn on ${to}.`;

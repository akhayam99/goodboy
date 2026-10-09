import type { RulesPick } from './rulesHeadroom';

type Params = {
  readonly canSpread: boolean;
  readonly spread: boolean;
  readonly pick: RulesPick | null;
};

export const spreadSentence = ({ canSpread, spread, pick }: Params): string => {
  if (!canSpread) {
    return 'Needs a provider that reports limits';
  }
  if (!spread || pick === null) {
    return 'New steps follow the provider order.';
  }
  switch (pick.reason.kind) {
    case 'passed-tight':
      return `${pick.reason.passed} is at ${Math.round(pick.reason.used * 100)}%, so new steps go to ${pick.name} first.`;
    case 'passed-out':
      return `${pick.reason.passed} is at its limit, so new steps go to ${pick.name} first.`;
    case 'first-in-order':
    case 'most-room':
      return 'New steps go to the provider with the most room.';
    default: {
      const unreachable: never = pick.reason;
      return unreachable;
    }
  }
};

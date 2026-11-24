import { LIMITS_WARNING_FRACTION, PROVIDERS_REPORTING_LIMITS } from '@goodboy/core/providers';
import { PROVIDER_LABEL } from '../providers/providerLabel';
import type { RulesPick } from './rulesHeadroom';

type Params = {
  readonly canSpread: boolean;
  readonly spread: boolean;
  readonly pick: RulesPick | null;
};

const REPORTING = new Intl.ListFormat('en', { type: 'conjunction' }).format(
  PROVIDERS_REPORTING_LIMITS.map((id) => PROVIDER_LABEL[id]),
);

const WHO_REPORTS = `Only ${REPORTING} report limits.`;

const WARNING_PERCENT = Math.round(LIMITS_WARNING_FRACTION * 100);

export const spreadSentence = ({ canSpread, spread, pick }: Params): string => {
  if (!canSpread) {
    return `${WHO_REPORTS} Turn one on to use this.`;
  }
  if (!spread || pick === null) {
    return `New agents follow the provider order. ${WHO_REPORTS}`;
  }
  switch (pick.reason.kind) {
    case 'passed-tight':
      return `${pick.reason.passed} is at ${Math.round(pick.reason.used * 100)}%, so new agents start on ${pick.name}.`;
    case 'passed-out':
      return `${pick.reason.passed} is at its limit, so new agents start on ${pick.name}.`;
    case 'first-in-order':
    case 'most-room':
      return `Past ${WARNING_PERCENT}% of a limit, new agents start on the next provider. ${WHO_REPORTS}`;
    default: {
      const unreachable: never = pick.reason;
      return unreachable;
    }
  }
};

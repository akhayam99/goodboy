import { stripOutcomeLine } from '@goodboy/core/auto';
import type { AutoDelegation } from '@goodboy/db';
import { declaredSummaryOf } from './declaredSummaryOf';
import { delegationReasonTextOf } from './delegationReasonTextOf';
import { returnedRequestOf } from './returnedRequestOf';

type Params = {
  readonly delegation: Pick<AutoDelegation, 'outcome' | 'reason' | 'result'>;
};

const declaredProseOf = ({ delegation }: Pick<Params, 'delegation'>): string | null => {
  const summary = declaredSummaryOf({ delegation });
  if (summary === null) {
    return null;
  }
  const prose = stripOutcomeLine({ text: summary });
  return prose === '' ? null : prose;
};

export const delegationSentenceOf = ({ delegation }: Params): string | null => {
  const text = delegationReasonTextOf({ reason: delegation.reason });
  if (delegation.outcome !== 'blocked') {
    return text;
  }
  return returnedRequestOf({ delegation }) ?? declaredProseOf({ delegation }) ?? text;
};

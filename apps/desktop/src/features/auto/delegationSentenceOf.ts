import type { AutoDelegation } from '@goodboy/db';
import { declaredSummaryOf } from './declaredSummaryOf';
import { delegationReasonTextOf } from './delegationReasonTextOf';

type Params = {
  readonly delegation: Pick<AutoDelegation, 'outcome' | 'reason' | 'result'>;
};

export const delegationSentenceOf = ({ delegation }: Params): string | null => {
  const text = delegationReasonTextOf({ reason: delegation.reason });
  return delegation.outcome === 'blocked' ? (declaredSummaryOf({ delegation }) ?? text) : text;
};

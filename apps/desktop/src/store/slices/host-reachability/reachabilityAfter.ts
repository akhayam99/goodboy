import type { HostFailureKind } from '../../../shared/lib/hostFailure';
import type { HostReachability } from './types';

export type HostAnswer = HostFailureKind | 'ok';

type Params = {
  readonly previous: HostReachability | undefined;
  readonly answer: HostAnswer;
  readonly now: number;
};

export const reachabilityAfter = ({
  previous,
  answer,
  now,
}: Params): HostReachability | undefined => {
  if (answer === 'network' || answer === 'timeout') {
    return previous?.status === 'unreachable'
      ? { ...previous, failures: previous.failures + 1, lastFailureAt: now, reason: answer }
      : { status: 'unreachable', since: now, failures: 1, lastFailureAt: now, reason: answer };
  }
  return previous?.status === 'unreachable' ? { status: 'recovered', at: now } : previous;
};

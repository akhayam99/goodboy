import { HOST_BACKOFF } from '../../../shared/utils/hostBackoff';
import type { HostReachability } from './types';

const JITTER_SHARE = 0.9;

type Params = {
  readonly entry: HostReachability | undefined;
  readonly now: number;
};

export const isHostAskDue = ({ entry, now }: Params): boolean => {
  if (entry === undefined || entry.status === 'recovered') {
    return true;
  }
  if (entry.failures < HOST_BACKOFF.slowAfterUnreachable) {
    return true;
  }
  return now - entry.lastFailureAt >= HOST_BACKOFF.slowPollMs * JITTER_SHARE;
};

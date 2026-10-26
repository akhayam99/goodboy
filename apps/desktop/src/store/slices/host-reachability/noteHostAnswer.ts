import type { SliceDeps } from '../../slice-types';
import { reachabilityAfter, type HostAnswer } from './reachabilityAfter';
import type { ReachabilityHost } from './types';
import { withHost } from './withHost';

type Params = {
  readonly host: ReachabilityHost;
  readonly answer: HostAnswer;
  readonly askedAt: number;
};

export const noteHostAnswer = ({ set, get }: SliceDeps) => {
  return ({ host, answer, askedAt }: Params): void => {
    if (askedAt < (get().hostAnsweredAt[host] ?? 0)) {
      return;
    }
    const now = Date.now();
    set((state) => ({
      hostAnsweredAt: { ...state.hostAnsweredAt, [host]: askedAt },
      hostReachability: withHost({
        map: state.hostReachability,
        host,
        next: reachabilityAfter({ previous: state.hostReachability[host], answer, now }),
      }),
    }));
  };
};

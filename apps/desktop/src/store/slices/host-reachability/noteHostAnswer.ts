import type { SliceDeps } from '../../slice-types';
import { reachabilityAfter, type HostAnswer } from './reachabilityAfter';
import type { ReachabilityHost } from './types';
import { withHost } from './withHost';

type Params = {
  readonly host: ReachabilityHost;
  readonly answer: HostAnswer;
  readonly askedAt: number;
};

type OwnedAnswers = Partial<Record<ReachabilityHost, number>>;

export const noteHostAnswer = ({ set, get }: SliceDeps) => {
  let ownedAnswers: OwnedAnswers | null = null;
  return ({ host, answer, askedAt }: Params): void => {
    const state = get();
    if (askedAt < (state.hostAnsweredAt[host] ?? 0)) {
      return;
    }
    const previous = state.hostReachability[host];
    const next = reachabilityAfter({ previous, answer, now: Date.now() });
    if (next === previous && ownedAnswers !== null && state.hostAnsweredAt === ownedAnswers) {
      ownedAnswers[host] = askedAt;
      return;
    }
    const answered: OwnedAnswers = { ...state.hostAnsweredAt, [host]: askedAt };
    ownedAnswers = answered;
    set((current) => ({
      hostAnsweredAt: answered,
      hostReachability: withHost({ map: current.hostReachability, host, next }),
    }));
  };
};

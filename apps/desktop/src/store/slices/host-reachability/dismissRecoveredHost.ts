import type { SliceDeps } from '../../slice-types';
import type { ReachabilityHost } from './types';
import { withHost } from './withHost';

type Params = {
  readonly host: ReachabilityHost;
};

export const dismissRecoveredHost = ({ set }: SliceDeps) => {
  return ({ host }: Params): void => {
    set((state) =>
      state.hostReachability[host]?.status === 'recovered'
        ? { hostReachability: withHost({ map: state.hostReachability, host, next: undefined }) }
        : state,
    );
  };
};

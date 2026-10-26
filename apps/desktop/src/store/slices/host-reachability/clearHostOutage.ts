import type { SliceDeps } from '../../slice-types';
import type { ReachabilityHost } from './types';
import { withHost } from './withHost';

type Params = {
  readonly host: ReachabilityHost;
};

export const clearHostOutage = ({ set }: SliceDeps) => {
  return ({ host }: Params): void => {
    set((state) => ({
      hostReachability: withHost({ map: state.hostReachability, host, next: undefined }),
    }));
  };
};

import type { HostReachability, HostReachabilityMap, ReachabilityHost } from './types';

type Params = {
  readonly map: HostReachabilityMap;
  readonly host: ReachabilityHost;
  readonly next: HostReachability | undefined;
};

export const withHost = ({ map, host, next }: Params): HostReachabilityMap => {
  const { [host]: _removed, ...rest } = map;
  return next === undefined ? rest : { ...rest, [host]: next };
};

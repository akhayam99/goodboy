import type { HostAnsweredAtMap, HostReachabilityMap } from './types';

export type HostReachabilityState = {
  readonly hostReachability: HostReachabilityMap;
  readonly hostAnsweredAt: HostAnsweredAtMap;
};

export const hostReachabilityInitialState: HostReachabilityState = {
  hostReachability: {},
  hostAnsweredAt: {},
};

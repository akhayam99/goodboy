export type ReachabilityHost = 'gitlab' | 'bitbucket';

type UnreachableReason = 'network' | 'timeout';

export type HostReachability =
  | {
      readonly status: 'unreachable';
      readonly since: number;
      readonly failures: number;
      readonly lastFailureAt: number;
      readonly reason: UnreachableReason;
    }
  | {
      readonly status: 'recovered';
      readonly at: number;
    };

export type HostReachabilityMap = Readonly<Partial<Record<ReachabilityHost, HostReachability>>>;

export type HostAnsweredAtMap = Readonly<Partial<Record<ReachabilityHost, number>>>;

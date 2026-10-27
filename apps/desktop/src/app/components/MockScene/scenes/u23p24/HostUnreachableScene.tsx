import { useEffect } from 'react';
import { HostReachabilityLine } from '../../../AppTopBar/HostReachabilityLine';
import { useAppStore } from '../../../../../store';

const SINCE = Date.UTC(2026, 9, 24, 10, 42, 0);

export const HostUnreachableScene = () => {
  useEffect(() => {
    useAppStore.setState({
      hostReachability: {
        gitlab: {
          status: 'unreachable',
          since: SINCE,
          failures: 3,
          lastFailureAt: SINCE,
          reason: 'network',
        },
      },
      retryHost: async () => undefined,
    });
  }, []);
  return (
    <div className="flex h-screen flex-col">
      <HostReachabilityLine />
    </div>
  );
};

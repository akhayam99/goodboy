import { useAppStore } from '../../../../store';
import type { ReachabilityHost } from '../../../../store/slices/host-reachability/types';
import { HostReachabilityRow } from './HostReachabilityRow';

const HOSTS: ReadonlyArray<ReachabilityHost> = ['gitlab', 'bitbucket'];

export const HostReachabilityLine = () => {
  const reachability = useAppStore((state) => state.hostReachability);
  const rows = HOSTS.flatMap((host) => {
    const entry = reachability[host];
    return entry === undefined ? [] : [{ host, entry }];
  });
  if (rows.length === 0) {
    return null;
  }
  return (
    <div data-slot="host-reachability" className="flex flex-col gap-1 px-2 pb-2">
      {rows.map(({ host, entry }) => (
        <HostReachabilityRow key={host} host={host} entry={entry} />
      ))}
    </div>
  );
};

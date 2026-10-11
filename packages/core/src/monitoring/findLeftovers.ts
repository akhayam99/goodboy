import type { Leftover, LedgerRow, MonitorSnapshot } from './types';

type Params = {
  readonly snapshot: MonitorSnapshot;
  readonly ledger: ReadonlyArray<LedgerRow>;
};

export const findLeftovers = ({ snapshot, ledger }: Params): ReadonlyArray<Leftover> => {
  const leftovers: Leftover[] = [];
  for (const entry of ledger) {
    if (entry.pgid === null || entry.kind === 'probe') {
      continue;
    }
    const group = snapshot.processes.filter((process) => process.pgid === entry.pgid);
    const isLeaderAlive = group.some((process) => process.pid === entry.pid);
    if (isLeaderAlive || group.length === 0) {
      continue;
    }
    leftovers.push({
      spawnId: entry.spawnId,
      kind: entry.kind,
      pgid: entry.pgid,
      sessionId: entry.sessionId,
      mountPath: entry.mountPath,
      processes: group,
    });
  }
  return leftovers;
};

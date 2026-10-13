import type { PortRow } from '@goodboy/core';

type Params = {
  readonly rows: ReadonlyArray<PortRow>;
};

type PortGroupItem =
  | { readonly kind: 'single'; readonly key: string; readonly row: PortRow }
  | {
      readonly kind: 'shared';
      readonly key: string;
      readonly pid: number;
      readonly rows: ReadonlyArray<PortRow>;
    };

export type GroupedPortRows = {
  readonly inUse: ReadonlyArray<PortGroupItem>;
  readonly free: ReadonlyArray<PortRow>;
};

type PidMap = Map<number, PortRow[]>;

const distinctPorts = ({ rows }: Params): number => new Set(rows.map((row) => row.port)).size;

export const groupPortRows = ({ rows }: Params): GroupedPortRows => {
  const listening = rows.filter((row) => row.state === 'listening');
  const free = rows.filter((row) => row.state !== 'listening');
  const byPid: PidMap = new Map();
  for (const row of listening) {
    if (row.pid !== null) {
      byPid.set(row.pid, [...(byPid.get(row.pid) ?? []), row]);
    }
  }
  const inUse: PortGroupItem[] = [];
  const seenPids = new Set<number>();
  for (const row of listening) {
    const shared = row.pid === null ? undefined : byPid.get(row.pid);
    if (row.pid === null || shared === undefined || distinctPorts({ rows: shared }) < 2) {
      inUse.push({ kind: 'single', key: row.key, row });
      continue;
    }
    if (seenPids.has(row.pid)) {
      continue;
    }
    seenPids.add(row.pid);
    inUse.push({
      kind: 'shared',
      key: `shared:${row.pid}`,
      pid: row.pid,
      rows: [...shared].sort((a, b) => a.port - b.port),
    });
  }
  return { inUse, free };
};

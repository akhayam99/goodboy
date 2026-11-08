import type { LedgerRow, PortRow } from '@goodboy/core/monitoring';
import { isOnTarget } from './isOnTarget';
import { ledgerKindWord } from './ledgerKindWord';
import type { MonitoringTarget } from './monitoringTarget';
import type { OwnedMount } from './ownedMountsOf';
import { portMountOf } from './portMountOf';

export type RunningHereItem = {
  readonly key: string;
  readonly port: number;
  readonly label: string;
  readonly word: string | null;
};

type Params = {
  readonly rows: ReadonlyArray<PortRow>;
  readonly ledger: ReadonlyArray<LedgerRow>;
  readonly mounts: ReadonlyArray<OwnedMount>;
  readonly target: MonitoringTarget;
};

type WordParams = {
  readonly row: PortRow;
};

const ownerWordOf = ({ row }: WordParams): string | null => {
  const { owner } = row;
  if (owner === null || owner.kind === 'external' || owner.kind === 'project') {
    return null;
  }
  return owner.kind === 'worktree' ? null : ledgerKindWord({ kind: owner.ledgerKind });
};

export const runningHereOf = ({
  rows,
  ledger,
  mounts,
  target,
}: Params): ReadonlyArray<RunningHereItem> => {
  const ledgerBySpawn = new Map(ledger.map((entry) => [entry.spawnId, entry]));
  const seen = new Set<number>();
  const items: RunningHereItem[] = [];
  for (const row of rows) {
    if (row.state !== 'listening' || seen.has(row.port)) {
      continue;
    }
    if (!isOnTarget({ mount: portMountOf({ row, ledgerBySpawn, mounts }), target })) {
      continue;
    }
    seen.add(row.port);
    items.push({
      key: row.key,
      port: row.port,
      label: (row.label === `:${row.port}` ? null : row.label) ?? row.processName ?? 'process',
      word: ownerWordOf({ row }),
    });
  }
  return items.sort((a, b) => a.port - b.port);
};

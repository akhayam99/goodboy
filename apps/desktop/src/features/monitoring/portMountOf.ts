import type { LedgerRow, PortRow } from '@goodboy/core/monitoring';
import { ledgerMountOf } from './ledgerMountOf';
import { mountContaining } from './mountContaining';
import type { OwnedMount } from './ownedMountsOf';

type Params = {
  readonly row: PortRow;
  readonly ledgerBySpawn: ReadonlyMap<string, LedgerRow>;
  readonly mounts: ReadonlyArray<OwnedMount>;
};

export const portMountOf = ({ row, ledgerBySpawn, mounts }: Params): OwnedMount | null => {
  const { owner } = row;
  if (owner === null || owner.kind === 'external' || owner.kind === 'project') {
    return null;
  }
  if (owner.kind === 'worktree') {
    return mountContaining({ mounts, sessionId: owner.sessionId, path: owner.worktreePath });
  }
  const entry = ledgerBySpawn.get(owner.spawnId);
  const sessionId = owner.sessionId ?? entry?.sessionId ?? null;
  const path = owner.worktreePath ?? entry?.mountPath ?? entry?.cwd ?? null;
  if (entry === undefined) {
    return mountContaining({ mounts, sessionId, path });
  }
  return ledgerMountOf({ entry, mounts, sessionId, path });
};

import type { LedgerRow } from '@goodboy/core/monitoring';
import { mountContaining } from './mountContaining';
import type { OwnedMount } from './ownedMountsOf';

type LedgerEntry = Pick<LedgerRow, 'mountId' | 'branch' | 'branchPath'>;

type Params = {
  readonly entry: LedgerEntry;
  readonly mounts: ReadonlyArray<OwnedMount>;
  readonly sessionId: string | null;
  readonly path: string | null;
};

type ElsewhereParams = {
  readonly entry: LedgerEntry;
  readonly mount: OwnedMount;
};

const isReadElsewhere = ({ entry, mount }: ElsewhereParams): boolean => {
  const { branchPath } = entry;
  if (branchPath == null || branchPath === '') {
    return false;
  }
  return mountContaining({ mounts: [mount], sessionId: null, path: branchPath }) === null;
};

export const ledgerMountOf = ({ entry, mounts, sessionId, path }: Params): OwnedMount | null => {
  const recorded =
    entry.mountId == null ? undefined : mounts.find((mount) => mount.mountId === entry.mountId);
  const mount = recorded ?? mountContaining({ mounts, sessionId, path });
  if (mount === null) {
    return null;
  }
  const { branch } = entry;
  if (branch == null || branch === '' || branch === mount.branch) {
    return mount;
  }
  if (recorded !== undefined && isReadElsewhere({ entry, mount: recorded })) {
    return mount;
  }
  return { ...mount, branch };
};

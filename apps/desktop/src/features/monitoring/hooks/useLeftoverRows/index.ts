import { useMemo } from 'react';
import { useAppStore } from '../../../../store';
import { selectLeftovers } from '../../../../store/slices/monitoring/selectLeftovers';
import { selectOwnedMounts } from '../../../../store/slices/monitoring/selectOwnedMounts';
import { isOnTarget } from '../../isOnTarget';
import { leftoverRows, type LeftoverRow } from '../../leftoverRows';
import type { MonitoringTarget } from '../../monitoringTarget';

type Params = {
  readonly target: MonitoringTarget | null;
};

export const useLeftoverRows = ({ target }: Params): ReadonlyArray<LeftoverRow> => {
  const leftovers = useAppStore(selectLeftovers);
  const ledger = useAppStore((state) => state.monitorLedger);
  const sessions = useAppStore((state) => state.sessions);
  const mounts = useAppStore((state) => selectOwnedMounts({ state }));
  return useMemo(
    () =>
      leftoverRows({ leftovers, ledger, sessions, mounts }).filter((row) =>
        isOnTarget({ mount: row.mount, target }),
      ),
    [leftovers, ledger, sessions, mounts, target],
  );
};

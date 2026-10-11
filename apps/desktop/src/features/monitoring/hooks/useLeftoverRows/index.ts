import { useMemo } from 'react';
import { useAppStore } from '../../../../store';
import { selectLeftovers } from '../../../../store/slices/monitoring/selectLeftovers';
import { leftoverRows, type LeftoverRow } from '../../leftoverRows';

export const useLeftoverRows = (): ReadonlyArray<LeftoverRow> => {
  const leftovers = useAppStore(selectLeftovers);
  const ledger = useAppStore((state) => state.monitorLedger);
  const sessions = useAppStore((state) => state.sessions);
  return useMemo(
    () => leftoverRows({ leftovers, ledger, sessions }),
    [leftovers, ledger, sessions],
  );
};

import { useEffect, useState } from 'react';
import { useAppStore } from '../../../../store';
import { nextIdleCounts } from '../../stuckProcesses';

const NO_COUNTS: ReadonlyMap<number, number> = new Map();

export const useIdleCounts = (): ReadonlyMap<number, number> => {
  const snapshot = useAppStore((state) => state.monitorSnapshot);
  const [counts, setCounts] = useState<ReadonlyMap<number, number>>(NO_COUNTS);

  useEffect(() => {
    if (snapshot === null) {
      return;
    }
    setCounts((previous) => nextIdleCounts({ previous, snapshot }));
  }, [snapshot]);

  return counts;
};

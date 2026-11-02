import { useEffect } from 'react';
import type { DiffBodies } from '../../components/DiffView/types';

type Params = {
  readonly bodies: DiffBodies | null;
  readonly seen: ReadonlySet<string>;
};

export const useRequestSeenBodies = ({ bodies, seen }: Params): void => {
  useEffect(() => {
    if (bodies === null) {
      return;
    }
    for (const path of seen) {
      if (bodies.stateOf({ path }) === 'pending') {
        bodies.request({ path });
      }
    }
  }, [bodies, seen]);
};

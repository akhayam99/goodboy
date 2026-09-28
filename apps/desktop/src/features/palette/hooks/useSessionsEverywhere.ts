import { useEffect, useState } from 'react';
import { listSessionTitlesAcrossWorkspaces, type SessionTitleRef } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';

const NONE: ReadonlyArray<SessionTitleRef> = [];

export const useSessionsEverywhere = (): ReadonlyArray<SessionTitleRef> => {
  const [refs, setRefs] = useState<ReadonlyArray<SessionTitleRef>>(NONE);
  useEffect(() => {
    let isLive = true;
    listSessionTitlesAcrossWorkspaces({ db: tauriDatabase })
      .then((next) => {
        if (isLive) {
          setRefs(next);
        }
      })
      .catch(() => undefined);
    return () => {
      isLive = false;
    };
  }, []);
  return refs;
};

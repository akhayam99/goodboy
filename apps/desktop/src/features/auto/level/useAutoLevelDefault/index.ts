import { useEffect, useState } from 'react';
import { DEFAULT_AUTO_LEVEL, type AutoLevel } from '@goodboy/core';
import type { WorkspaceId } from '@goodboy/types';
import { tauriDatabase } from '../../../../shared/lib/db';
import { readAutoLevel } from '../../../../store/runtime/auto/level/readAutoLevel';

type Params = {
  readonly workspaceId: WorkspaceId;
};

export const useAutoLevelDefault = ({ workspaceId }: Params): AutoLevel => {
  const [level, setLevel] = useState<AutoLevel>(DEFAULT_AUTO_LEVEL);
  useEffect(() => {
    let isCurrent = true;
    setLevel(DEFAULT_AUTO_LEVEL);
    readAutoLevel({ db: tauriDatabase, target: { workspaceId } })
      .then((next) => {
        if (isCurrent) {
          setLevel(next);
        }
      })
      .catch(() => undefined);
    return () => {
      isCurrent = false;
    };
  }, [workspaceId]);
  return level;
};

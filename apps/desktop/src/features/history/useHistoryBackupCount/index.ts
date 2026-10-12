import { useEffect, useState } from 'react';
import { listHistoryBackups } from '../historyEngine';

type Params = {
  readonly worktreePath: string;
  readonly branch: string;
  readonly revision: number;
};

export const useHistoryBackupCount = ({ worktreePath, branch, revision }: Params): number => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    setCount(0);
    if (branch === '') {
      return;
    }
    let isCurrent = true;
    void listHistoryBackups({ worktreePath, branch })
      .then((found) => {
        if (isCurrent) {
          setCount(found.length);
        }
      })
      .catch(() => {
        if (isCurrent) {
          setCount(0);
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [branch, revision, worktreePath]);
  return count;
};

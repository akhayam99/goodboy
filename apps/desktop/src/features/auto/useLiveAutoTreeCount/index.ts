import { useEffect, useState } from 'react';
import { countLiveAutoTrees } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { useAppStore } from '../../../store';

const POLL_MS = 5000;

export const useLiveAutoTreeCount = (): number => {
  const [count, setCount] = useState(0);
  const reportError = useAppStore((state) => state.reportError);

  useEffect(() => {
    let isCurrent = true;
    let hasReported = false;
    const read = () => {
      countLiveAutoTrees({ db: tauriDatabase })
        .then((live) => {
          hasReported = false;
          if (isCurrent) {
            setCount(live);
          }
        })
        .catch((error: unknown) => {
          if (hasReported) {
            return;
          }
          hasReported = true;
          void reportError({ title: "Couldn't count the running Auto agents", error });
        });
    };
    read();
    const id = window.setInterval(read, POLL_MS);
    return () => {
      isCurrent = false;
      window.clearInterval(id);
    };
  }, [reportError]);

  return count;
};

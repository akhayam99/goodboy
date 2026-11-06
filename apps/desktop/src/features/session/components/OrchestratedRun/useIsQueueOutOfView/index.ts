import { useEffect, useState } from 'react';
import type { WorkflowRunId } from '@goodboy/types';

type Params = {
  readonly runId: WorkflowRunId;
  readonly isWatched: boolean;
};

export const useIsQueueOutOfView = ({ runId, isWatched }: Params): boolean => {
  const [isOut, setIsOut] = useState(false);

  useEffect(() => {
    if (!isWatched || typeof IntersectionObserver === 'undefined') {
      setIsOut(false);
      return;
    }
    const queue = document.querySelector(`[data-hint-queue="${CSS.escape(runId)}"]`);
    if (queue === null) {
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      const last = entries.at(-1);
      if (last !== undefined) {
        setIsOut(!last.isIntersecting);
      }
    });
    observer.observe(queue);
    return () => observer.disconnect();
  }, [runId, isWatched]);

  return isOut;
};

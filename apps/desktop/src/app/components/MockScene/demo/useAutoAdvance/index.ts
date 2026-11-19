import { useEffect, useRef, useState } from 'react';

type Params = {
  readonly chapterId: string;
  readonly isDone: boolean;
  readonly dwellMs: number;
  readonly onLoadDone: () => void;
  readonly onArriveDone: () => void;
  readonly onAdvance: () => void;
};

export const useAutoAdvance = ({
  chapterId,
  isDone,
  dwellMs,
  onLoadDone,
  onArriveDone,
  onAdvance,
}: Params): void => {
  const arrivedRef = useRef<string | undefined>(undefined);
  const [finishedId, setFinishedId] = useState<string | undefined>(undefined);
  const latest = useRef({ onLoadDone, onArriveDone, onAdvance });
  latest.current = { onLoadDone, onArriveDone, onAdvance };

  useEffect(() => {
    if (arrivedRef.current !== chapterId) {
      const isLoad = arrivedRef.current === undefined;
      arrivedRef.current = chapterId;
      setFinishedId(undefined);
      if (!isDone) {
        return;
      }
      if (isLoad) {
        latest.current.onLoadDone();
        return;
      }
      latest.current.onArriveDone();
      return;
    }
    setFinishedId(isDone ? chapterId : undefined);
  }, [chapterId, isDone]);

  const isFinished = isDone && finishedId === chapterId;

  useEffect(() => {
    if (!isFinished) {
      return;
    }
    const timer = window.setTimeout(() => latest.current.onAdvance(), dwellMs);
    return () => window.clearTimeout(timer);
  }, [isFinished, dwellMs]);
};

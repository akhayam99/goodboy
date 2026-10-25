import { useEffect, useRef } from 'react';
import { announce } from '../../../../../shared/lib/announcer';
import { turnEndAnnouncement } from './turnEndAnnouncement';

type Params = {
  readonly isTurnLive: boolean;
  readonly rows: ReadonlyArray<{ readonly kind: string }>;
};

export const useTurnEndAnnouncement = ({ isTurnLive, rows }: Params): void => {
  const wasLive = useRef(isTurnLive);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  useEffect(() => {
    const wasLiveBefore = wasLive.current;
    wasLive.current = isTurnLive;
    if (wasLiveBefore && !isTurnLive) {
      announce({ message: turnEndAnnouncement({ rows: rowsRef.current }) });
    }
  }, [isTurnLive]);
};

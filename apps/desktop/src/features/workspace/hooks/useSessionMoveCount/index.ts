import { useMemo } from 'react';
import type { Session, SessionStageInfo } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { needsYouOf } from '../../../board/queue/needsYouOf';
import { useQueueSends } from '../../../board/queue/QueueBoard/useQueueSends';

type Params = {
  readonly session: Session;
  readonly info: SessionStageInfo;
};

export const useSessionMoveCount = ({ session, info }: Params): number => {
  const questions = useAppStore((state) => state.sessionOpenQuestions[session.id] ?? EMPTY_ARRAY);
  const notNow = useQueueSends((state) => state.notNow);
  const pending = useQueueSends((state) => state.pending);
  return useMemo(() => {
    const queued = new Set(
      Object.values(pending).flatMap((send) => (send.moveId === null ? [] : [send.moveId])),
    );
    return needsYouOf({
      sessions: [session],
      infos: { [session.id]: info },
      openQuestions: { [session.id]: questions },
      notNow,
      queued,
    }).moveCount;
  }, [session, info, questions, notNow, pending]);
};

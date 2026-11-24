import { useMemo } from 'react';
import type { Session, SessionStageInfo } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { needsYouOf } from '../../../board/needsYou/needsYouOf';

type Params = {
  readonly session: Session;
  readonly info: SessionStageInfo;
};

export const useSessionMoveCount = ({ session, info }: Params): number => {
  const questions = useAppStore((state) => state.sessionOpenQuestions[session.id] ?? EMPTY_ARRAY);
  return useMemo(
    () =>
      needsYouOf({
        sessions: [session],
        infos: { [session.id]: info },
        openQuestions: { [session.id]: questions },
      }).moveCount,
    [session, info, questions],
  );
};

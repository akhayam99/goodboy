import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { OpenQuestion, Session } from '@goodboy/types';
import { useAppStore } from '../../../../../../store';
import { stageInfosOf } from '../../../../../../store/slices/session-view/stageInfosOf';
import { needsYouOf, type NeedsYou } from '../../../../../board/needsYou/needsYouOf';

type Params = {
  readonly sessions: ReadonlyArray<Session>;
};

export const useNeedsYou = ({ sessions }: Params): NeedsYou => {
  const infos = useAppStore((state) => stageInfosOf({ state, sessions }));
  const openQuestions = useAppStore(
    useShallow((state) => {
      const picked: Record<string, ReadonlyArray<OpenQuestion>> = {};
      for (const session of sessions) {
        const questions = state.sessionOpenQuestions[session.id];
        if (questions !== undefined) {
          picked[session.id] = questions;
        }
      }
      return picked;
    }),
  );
  return useMemo(
    () => needsYouOf({ sessions, infos, openQuestions }),
    [infos, openQuestions, sessions],
  );
};

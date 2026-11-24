import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Agent, OpenQuestion, Session, SessionStageInfo } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../../../store';
import { waitingQuestionsOf } from '../../../../../session/waitingQuestionsOf';
import { needsYouOf, type NeedsYou } from '../../../../../board/needsYou/needsYouOf';

type Params = {
  readonly sessions: ReadonlyArray<Session>;
  readonly infos: Readonly<Record<string, SessionStageInfo>>;
};

export const useNeedsYou = ({ sessions, infos }: Params): NeedsYou => {
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
  const agents = useAppStore(
    useShallow((state) => {
      const picked: Record<string, ReadonlyArray<Agent>> = {};
      for (const session of sessions) {
        if (openQuestions[session.id] !== undefined) {
          picked[session.id] = state.sessionPhaseRuns[session.id] ?? EMPTY_ARRAY;
        }
      }
      return picked;
    }),
  );
  return useMemo(() => {
    const waiting: Record<string, ReadonlyArray<OpenQuestion>> = {};
    for (const [sessionId, questions] of Object.entries(openQuestions)) {
      waiting[sessionId] = waitingQuestionsOf({
        questions,
        agents: agents[sessionId] ?? EMPTY_ARRAY,
      });
    }
    return needsYouOf({ sessions, infos, openQuestions: waiting });
  }, [agents, infos, openQuestions, sessions]);
};

import { useEffect, useMemo } from 'react';
import type { OpenQuestion, ResolveAttempt, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { openQuestionOfThread } from '../../../../store/slices/resolve/threadQuestions';

type Params = {
  readonly sessionId: SessionId;
  readonly threadId: string;
  readonly question: string | null;
};

export type ThreadQuestion = {
  readonly open: OpenQuestion | null;
  readonly answer: string | null;
};

export const useThreadQuestion = ({ sessionId, threadId, question }: Params): ThreadQuestion => {
  const attempts = useAppStore(
    (s) => s.sessionResolveAttempts[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<ResolveAttempt>),
  );
  const openQuestions = useAppStore(
    (s) => s.sessionOpenQuestions[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<OpenQuestion>),
  );
  const answer = useAppStore((s) => s.sessionResolveAnswers[sessionId]?.[threadId] ?? null);
  const loadSessionOpenQuestions = useAppStore((s) => s.loadSessionOpenQuestions);
  useEffect(() => {
    void loadSessionOpenQuestions(sessionId);
  }, [loadSessionOpenQuestions, sessionId]);
  return useMemo(
    () => ({
      open:
        openQuestionOfThread({ questions: openQuestions, attempts, threadId, question }) ?? null,
      answer,
    }),
    [answer, attempts, openQuestions, question, threadId],
  );
};

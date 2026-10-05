import { useMemo } from 'react';
import type { OpenQuestion, ResolveAttempt, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import type { FixRun } from '../activeFixRun';
import { bulkQuestionsOf, type BulkQuestion } from '../bulkQuestions';

const EMPTY_QUESTIONS: ReadonlyArray<OpenQuestion> = [];
const EMPTY_ATTEMPTS: ReadonlyArray<ResolveAttempt> = [];

export const useBulkQuestions = ({
  sessionId,
  run,
}: {
  readonly sessionId: SessionId;
  readonly run: FixRun | null;
}): ReadonlyArray<BulkQuestion> => {
  const questions = useAppStore((s) => s.sessionOpenQuestions[sessionId] ?? EMPTY_QUESTIONS);
  const attempts = useAppStore((s) => s.sessionResolveAttempts[sessionId] ?? EMPTY_ATTEMPTS);
  return useMemo(
    () => (run === null ? [] : bulkQuestionsOf({ run, questions, attempts })),
    [attempts, questions, run],
  );
};

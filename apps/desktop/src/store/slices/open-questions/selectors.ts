import type { OpenQuestion, SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';

const EMPTY_OPEN_QUESTIONS: ReadonlyArray<OpenQuestion> = [];

export const useSessionOpenQuestions = (sessionId: SessionId | null): ReadonlyArray<OpenQuestion> =>
  useAppStore((s) =>
    sessionId ? (s.sessionOpenQuestions[sessionId] ?? EMPTY_OPEN_QUESTIONS) : EMPTY_OPEN_QUESTIONS,
  );

export const useSessionAnsweredQuestions = (
  sessionId: SessionId | null,
): ReadonlyArray<OpenQuestion> =>
  useAppStore((s) =>
    sessionId
      ? (s.sessionAnsweredQuestions[sessionId] ?? EMPTY_OPEN_QUESTIONS)
      : EMPTY_OPEN_QUESTIONS,
  );

export const useSessionDismissedQuestions = (
  sessionId: SessionId | null,
): ReadonlyArray<OpenQuestion> =>
  useAppStore((s) =>
    sessionId
      ? (s.sessionDismissedQuestions[sessionId] ?? EMPTY_OPEN_QUESTIONS)
      : EMPTY_OPEN_QUESTIONS,
  );

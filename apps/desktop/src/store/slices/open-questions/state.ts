import type { SessionId, OpenQuestion, AgentId, OpenQuestionId } from '@goodboy/types';

export type OpenQuestionsState = {
  readonly sessionOpenQuestions: Readonly<Record<SessionId, ReadonlyArray<OpenQuestion>>>;
  readonly sessionAnsweredQuestions: Readonly<Record<SessionId, ReadonlyArray<OpenQuestion>>>;
  readonly sessionDismissedQuestions: Readonly<Record<SessionId, ReadonlyArray<OpenQuestion>>>;
  readonly sessionQuestionsLoadError: Readonly<Record<SessionId, string | undefined>>;
  readonly openQuestionScrollTarget: {
    readonly agentId: AgentId;
    readonly questionId: OpenQuestionId;
  } | null;
};

export const openQuestionsInitialState: OpenQuestionsState = {
  sessionOpenQuestions: {},
  sessionAnsweredQuestions: {},
  sessionDismissedQuestions: {},
  sessionQuestionsLoadError: {},
  openQuestionScrollTarget: null,
};

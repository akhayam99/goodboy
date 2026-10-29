import type { SessionId, OpenQuestion, AgentId, OpenQuestionId } from '@goodboy/types';
import type { OpenQuestionAnswerPair } from './persistOpenQuestionAnswers';
import type { AskingAgentId } from './sendAnswersToSettledAgents';

export type PendingOpenQuestionDelivery = {
  readonly attemptId: string;
  readonly pairs: ReadonlyArray<OpenQuestionAnswerPair>;
  readonly askingAgentIds: ReadonlyArray<AskingAgentId>;
  readonly error: string;
};

export type OpenQuestionsState = {
  readonly sessionOpenQuestions: Readonly<Record<SessionId, ReadonlyArray<OpenQuestion>>>;
  readonly sessionAnsweredQuestions: Readonly<Record<SessionId, ReadonlyArray<OpenQuestion>>>;
  readonly sessionDismissedQuestions: Readonly<Record<SessionId, ReadonlyArray<OpenQuestion>>>;
  readonly sessionQuestionsLoadError: Readonly<Record<SessionId, string | undefined>>;
  readonly pendingOpenQuestionDeliveries: Readonly<
    Record<SessionId, PendingOpenQuestionDelivery | undefined>
  >;
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
  pendingOpenQuestionDeliveries: {},
  openQuestionScrollTarget: null,
};

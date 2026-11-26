import type { OpenQuestion } from '@goodboy/types';
import type { SessionQuestionRow } from '../contract/projections';
import { actionIdOf } from './actionIdOf';
import { agentRoleOf } from './agentRoleOf';
import { isLeadAgentOf } from './isLeadAgentOf';
import { QUESTION_OPTION_LIMIT } from './questionDecisionOf';
import { safeTextOf } from './safeTextOf';
import type { WorkspaceScope } from './workspaceScope';

export const QUESTION_LIMIT = 12;

type Params = {
  readonly scope: WorkspaceScope;
  readonly sessionId: string;
};

type RowParams = {
  readonly scope: WorkspaceScope;
  readonly sessionId: string;
  readonly question: OpenQuestion;
};

const rowOf = ({ scope, sessionId, question }: RowParams): SessionQuestionRow => {
  const asker = (scope.agents[sessionId] ?? []).find(
    (agent) => agent.id === question.createdByAgentId,
  );
  const isOpen = question.status === 'open';
  return {
    id: question.id,
    state: isOpen ? 'open' : 'answered',
    text: safeTextOf({ text: question.text, max: 600 }),
    options: question.suggestedAnswers
      .slice(0, QUESTION_OPTION_LIMIT)
      .map((answer) => safeTextOf({ text: answer, max: 160 })),
    recommended:
      question.recommendedAnswer === undefined
        ? null
        : safeTextOf({ text: question.recommendedAnswer, max: 160 }),
    askedBy:
      asker === undefined
        ? null
        : agentRoleOf({ agent: asker, isLead: isLeadAgentOf({ scope, sessionId, agent: asker }) }),
    since: question.createdAt,
    answer:
      isOpen || question.userAnswer === null
        ? null
        : safeTextOf({ text: question.userAnswer, max: 600 }),
    answeredAt: isOpen ? null : (question.answeredAt ?? null),
    answerActionId: isOpen
      ? actionIdOf({ kind: 'answerQuestion', objectId: question.id, version: question.createdAt })
      : null,
  };
};

type NewestParams = {
  readonly left: OpenQuestion;
  readonly right: OpenQuestion;
};

const byNewest = ({ left, right }: NewestParams): number =>
  left.createdAt < right.createdAt ? 1 : left.createdAt > right.createdAt ? -1 : 0;

export const questionRowsOf = ({ scope, sessionId }: Params): ReadonlyArray<SessionQuestionRow> => {
  const open = (scope.openQuestions[sessionId] ?? []).filter(
    (question) => question.status === 'open',
  );
  const answered = (scope.answeredQuestions[sessionId] ?? []).filter(
    (question) => question.status === 'answered',
  );
  return [
    ...[...open].sort((left, right) => byNewest({ left, right })).slice(0, QUESTION_LIMIT),
    ...[...answered].sort((left, right) => byNewest({ left, right })).slice(0, QUESTION_LIMIT),
  ].map((question) => rowOf({ scope, sessionId, question }));
};

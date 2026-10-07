import type { OpenQuestion, PlanWithCount } from '@goodboy/types';

export const PLANNER_QUESTION_REASON = 'The planner asked a question. Answer it first.';

type Params = Readonly<{
  questions: ReadonlyArray<OpenQuestion>;
  plan: Pick<PlanWithCount, 'agentId'>;
}>;

export const plannerQuestionsOf = ({ questions, plan }: Params): ReadonlyArray<OpenQuestion> =>
  questions.filter(
    (question) => question.status === 'open' && question.createdByAgentId === plan.agentId,
  );

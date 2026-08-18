import type { Agent, OpenQuestion } from '@goodboy/types';

type Params = {
  readonly questions: ReadonlyArray<OpenQuestion>;
  readonly agent: Agent;
};

export const attachedQuestionsFor = ({ questions, agent }: Params): ReadonlyArray<OpenQuestion> => {
  const direct = questions.filter((question) => question.createdByAgentId === agent.id);
  const inferred =
    agent.workflowRunId == null
      ? []
      : questions.filter(
          (question) =>
            question.createdByAgentId == null &&
            question.workflowRunId === agent.workflowRunId &&
            question.createdByStepOrdinal === agent.ordinal,
        );
  return [...direct, ...inferred];
};

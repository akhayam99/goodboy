import type { OpenQuestion, WorkflowRun } from '@goodboy/types';

type Params = {
  readonly run: Pick<WorkflowRun, 'id' | 'orchestrationStop'>;
  readonly answered: ReadonlyArray<
    Pick<OpenQuestion, 'workflowRunId' | 'answerDeliveredAt' | 'userAnswer'>
  >;
};

export const heldAnswerCountOf = ({ run, answered }: Params): number => {
  const kind = run.orchestrationStop?.kind;
  if (kind == null || kind === 'questions' || kind === 'closed') {
    return 0;
  }
  return answered.filter(
    (question) =>
      question.workflowRunId === run.id &&
      question.answerDeliveredAt === undefined &&
      question.userAnswer !== null,
  ).length;
};

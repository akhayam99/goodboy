import type { OpenQuestion, WorkflowId, WorkflowRunId } from '@goodboy/types';

export type GatedRun = {
  readonly id: WorkflowRunId;
  readonly workflowId: WorkflowId | null;
};

type RunParams = {
  readonly questions: ReadonlyArray<OpenQuestion>;
  readonly run: GatedRun;
};

const blocksRun = ({
  question,
  run,
}: {
  readonly question: OpenQuestion;
  readonly run: GatedRun;
}) => {
  if (question.workflowRunId != null) {
    return question.workflowRunId === run.id;
  }
  return run.workflowId !== null && question.workflowId === run.workflowId;
};

export const workflowRunHasOpenQuestions = ({ questions, run }: RunParams): boolean =>
  questions.some((question) => question.status === 'open' && blocksRun({ question, run }));

export const workflowRunOpenQuestions = ({
  questions,
  run,
}: RunParams): ReadonlyArray<OpenQuestion> =>
  questions.filter((question) => question.status === 'open' && blocksRun({ question, run }));

type WorkflowParams = {
  readonly questions: ReadonlyArray<OpenQuestion>;
  readonly workflowId: WorkflowId;
};

export const workflowHasOpenQuestions = ({ questions, workflowId }: WorkflowParams): boolean =>
  questions.some((question) => question.status === 'open' && question.workflowId === workflowId);

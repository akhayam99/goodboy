import type { OpenQuestion, WorkflowOrchestrationStop, WorkflowRun } from '@goodboy/types';
import { workflowRunOpenQuestions } from './openQuestionsGate';

type Params = {
  readonly question: OpenQuestion;
  readonly runs: ReadonlyArray<Pick<WorkflowRun, 'id' | 'workflowId' | 'orchestrationStop'>>;
};

export const questionStopOf = ({ question, runs }: Params): WorkflowOrchestrationStop | null => {
  const run = runs.find(
    (candidate) =>
      workflowRunOpenQuestions({
        questions: [{ ...question, status: 'open' }],
        run: candidate,
      }).length > 0,
  );
  const stop = run?.orchestrationStop;
  return stop == null || stop.kind === 'questions' ? null : stop;
};

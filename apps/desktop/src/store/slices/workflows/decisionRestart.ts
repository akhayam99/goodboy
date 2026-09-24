import type { WorkflowRunId } from '@goodboy/types';
import type { GetFn, SetFn } from './types';

type RequestParams = {
  readonly set: SetFn;
  readonly workflowRunId: WorkflowRunId;
};

type MarkParams = {
  readonly get: GetFn;
  readonly workflowRunId: WorkflowRunId;
};

export const requestDecisionRestart = ({ set, workflowRunId }: RequestParams): void => {
  set((state) => ({
    decisionRestartMarks: {
      ...state.decisionRestartMarks,
      [workflowRunId]: (state.decisionRestartMarks[workflowRunId] ?? 0) + 1,
    },
  }));
};

export const decisionRestartMark = ({ get, workflowRunId }: MarkParams): number =>
  get().decisionRestartMarks[workflowRunId] ?? 0;

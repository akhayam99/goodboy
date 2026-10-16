import type { WorkflowRunId } from '@goodboy/types';
import { dispatchAfterNavigation } from '../actions/dispatchAfterNavigation';

export const RUN_ADD_STEP_EVENT = 'goodboy:run-add-step';

type Params = {
  readonly runId: WorkflowRunId;
};

export const requestRunAddStep = ({ runId }: Params): void => {
  dispatchAfterNavigation({ name: RUN_ADD_STEP_EVENT, detail: { runId } });
};

type RequestParams = {
  readonly event: Event;
  readonly runId: WorkflowRunId;
};

export const isRunAddStepRequest = ({ event, runId }: RequestParams): boolean => {
  if (!(event instanceof CustomEvent)) {
    return false;
  }
  const detail: unknown = event.detail;
  return (
    typeof detail === 'object' && detail !== null && 'runId' in detail && detail.runId === runId
  );
};

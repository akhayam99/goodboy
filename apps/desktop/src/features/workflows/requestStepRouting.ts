import type { WorkflowRunId } from '@goodboy/types';

export const STEP_ROUTING_REQUEST_EVENT = 'goodboy:toggle-step-routing';

type Params = {
  readonly runId: WorkflowRunId;
};

export const requestStepRouting = ({ runId }: Params): void => {
  window.dispatchEvent(new CustomEvent(STEP_ROUTING_REQUEST_EVENT, { detail: { runId } }));
};

type RequestParams = {
  readonly event: Event;
  readonly runId: WorkflowRunId;
};

export const isStepRoutingRequest = ({ event, runId }: RequestParams): boolean => {
  if (!(event instanceof CustomEvent)) {
    return false;
  }
  const detail: unknown = event.detail;
  return (
    typeof detail === 'object' && detail !== null && 'runId' in detail && detail.runId === runId
  );
};

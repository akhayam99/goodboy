import type { SessionId } from '@goodboy/types';
import type { GetFn } from './types';
import { WorkflowGateError } from './workflowActivationGate';

type Params = {
  readonly error: unknown;
  readonly sessionId: SessionId;
  readonly emitNotification: ReturnType<GetFn>['emitNotification'];
};

export const notifyWorkflowGateBlock = ({ error, sessionId, emitNotification }: Params): void => {
  if (!(error instanceof WorkflowGateError)) {
    throw error;
  }
  void emitNotification({
    kind: 'error',
    severity: 'warning',
    title: 'Workflow step held back',
    body: error.message,
    sessionId,
  });
};

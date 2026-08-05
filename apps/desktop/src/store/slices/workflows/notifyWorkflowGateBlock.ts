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
  void emitNotification('error', 'warning', 'workflow step held back', error.message, {
    sessionId,
  });
};

import type { AgentId, SessionId } from '@goodboy/types';
import type { SpawnFocus } from '../session-view/spawnFocus';
import { WorkflowGateError } from './workflowActivationGate';
import type { GetFn } from './types';

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly focus: SpawnFocus;
};

export const activateWorkflowAgentOrNotify = async ({
  get,
  sessionId,
  agentId,
  focus,
}: Params): Promise<void> => {
  try {
    await get().activateWorkflowAgent({ sessionId, agentId, focus });
  } catch (error) {
    if (!(error instanceof WorkflowGateError)) {
      throw error;
    }
    void get().emitNotification('error', 'warning', 'workflow step held back', error.message, {
      sessionId,
    });
  }
};

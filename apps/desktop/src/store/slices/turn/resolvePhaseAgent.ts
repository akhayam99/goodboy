import type {
  Agent,
  IsoDateTime,
  ProviderRunId,
  SessionId,
  Step,
  WorkflowRunId,
} from '@goodboy/types';
import { invokeAgentInsert, invokeAgentUpdateStatus } from '../../../features/workflows/workflows';
import { inferAgentKindFromName } from '../../../features/session/agent-kind';

type Params = {
  readonly sessionId: SessionId;
  readonly definition: Step;
  readonly workflowRunId: WorkflowRunId | null;
  readonly reusable: Agent | null;
  readonly providerRunId: ProviderRunId;
  readonly now: () => IsoDateTime;
};

export const resolvePhaseAgent = async ({
  sessionId,
  definition,
  workflowRunId,
  reusable,
  providerRunId,
  now,
}: Params): Promise<Agent> => {
  if (reusable != null) {
    return invokeAgentUpdateStatus(reusable.id, {
      status: 'running',
      providerRunId,
      startedAt: now(),
    });
  }

  return invokeAgentInsert({
    sessionId,
    stepId: definition.id,
    ...(workflowRunId != null && { workflowRunId }),
    ordinal: definition.ordinal,
    name: definition.name,
    status: 'running',
    providerRunId,
    startedAt: now(),
    kind: inferAgentKindFromName(definition.name),
  });
};

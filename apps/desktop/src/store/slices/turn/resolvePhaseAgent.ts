import type {
  Agent,
  IsoDateTime,
  ProviderRunId,
  SessionId,
  Step,
  WorkflowRunId,
} from '@goodboy/types';
import {
  invokeAgentGenerationReserve,
  invokeAgentInsert,
  invokeAgentUpdateStatus,
} from '../../../features/workflows/workflows';
import { classifyStep } from '../../../features/session/agent-kind';

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

  const reservation = await invokeAgentGenerationReserve({
    reservationId: `generation:workflow-step:${workflowRunId ?? sessionId}:${definition.id}`,
    sessionId,
    workflowRunId,
    parentAgentId: null,
    creationPath: 'workflow-step',
    count: 1,
  });
  if (reservation.kind === 'refused') {
    throw new Error(reservation.reason);
  }

  return invokeAgentInsert({
    sessionId,
    stepId: definition.id,
    ...(workflowRunId != null && { workflowRunId }),
    ordinal: definition.ordinal,
    name: definition.name,
    status: 'running',
    executionPurpose: 'standalone',
    providerRunId,
    startedAt: now(),
    kind: classifyStep({ step: definition }),
    generationReservationId: reservation.reservations[0]!.reservationId,
  });
};

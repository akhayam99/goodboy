import type { AgentId, GenerationCreationPath, SessionId, WorkflowRunId } from '@goodboy/types';
import {
  invokeAgentGenerationReserve,
  type GenerationReservationOutcome,
} from '../../../features/workflows/workflows';
import type { GetFn } from './types';

export type ReserveGenerationParams = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId | null;
  readonly parentAgentId: AgentId | null;
  readonly creationPath: GenerationCreationPath;
  readonly reservationKey: string;
  readonly count: number;
  readonly obligationId?: string | null;
  readonly purpose?: string | null;
  readonly label: string;
};

export const reserveGeneration = async ({
  get,
  sessionId,
  workflowRunId,
  parentAgentId,
  creationPath,
  reservationKey,
  count,
  obligationId = null,
  purpose = null,
  label,
}: ReserveGenerationParams): Promise<GenerationReservationOutcome> => {
  const outcome = await invokeAgentGenerationReserve({
    reservationId: `generation:${creationPath}:${reservationKey}`,
    sessionId,
    workflowRunId,
    parentAgentId,
    creationPath,
    count,
    obligationId,
    purpose,
  });
  if (outcome.kind === 'granted') {
    return outcome;
  }
  if (outcome.isFirstRefusal) {
    void get().emitNotification(
      'agent-auto-spawn',
      'warning',
      `generation refused: ${label}`,
      `${outcome.reason}. the work already done stays available and the obligation stays open and unowned. finish within your own capabilities or hand it over by hand.`,
      { sessionId },
    );
  }
  return outcome;
};

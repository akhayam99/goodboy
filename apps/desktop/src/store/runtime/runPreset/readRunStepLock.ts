import { getWorkspaceValue, type Database } from '@goodboy/db';
import type { AgentId, WorkflowRoutingLock, WorkspaceId } from '@goodboy/types';
import { parseRunPresets } from './parseRunPresets';

type Params = {
  readonly db: Database;
  readonly workspaceId: WorkspaceId;
  readonly agentId: AgentId;
  readonly role: string;
};

export const readRunStepLock = async ({
  db,
  workspaceId,
  agentId,
  role,
}: Params): Promise<WorkflowRoutingLock | null> => {
  const raw = await getWorkspaceValue({ db, workspaceId, key: 'run.preset' });
  const preset = parseRunPresets({ raw }).agents[agentId];
  if (preset === undefined) {
    return null;
  }
  return (
    preset.steps.find((step) => step.role === role && step.routingLock !== null)?.routingLock ??
    null
  );
};

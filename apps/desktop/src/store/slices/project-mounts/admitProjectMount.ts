import type {
  AgentId,
  MaterializationDeferralCause,
  Project,
  ProjectId,
  ProviderRunId,
  SessionId,
} from '@goodboy/types';
import {
  materializationGate,
  proposeMaterialization,
  type BatchBudget,
} from './materializationGate';
import type { EnsureProjectMountedResult, GetFn } from './types';

export type AdmitProjectMountOutcome =
  | Readonly<{ kind: 'mounted'; result: EnsureProjectMountedResult }>
  | Readonly<{
      kind: 'asked';
      cause: MaterializationDeferralCause;
      isAlreadyPending: boolean;
    }>;

type AdmitParams = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly project: Project;
  readonly reason: string;
  readonly budget: BatchBudget;
  readonly agentId: AgentId | null;
  readonly turnRunId: ProviderRunId | null;
  readonly taskIdentifiers?: ReadonlyArray<string>;
  readonly linkedProjectIds?: ReadonlyArray<ProjectId>;
};

export const admitProjectMount = async ({
  get,
  sessionId,
  project,
  reason,
  budget,
  agentId,
  turnRunId,
  taskIdentifiers,
  linkedProjectIds = [],
}: AdmitParams): Promise<AdmitProjectMountOutcome> => {
  const decision = materializationGate({
    get,
    sessionId,
    project,
    immediateProjectIds: budget.immediateProjectIds,
    linkedProjectIds,
  });
  if (decision.kind === 'deferred') {
    const proposal = await proposeMaterialization({
      get,
      sessionId,
      project,
      reason,
      cause: decision.cause,
      agentId,
      turnRunId,
    });
    return {
      kind: 'asked',
      cause: decision.cause,
      isAlreadyPending: proposal === 'already-pending',
    };
  }
  const result = await get().ensureProjectMounted({
    sessionId,
    projectId: project.id,
    reason,
    ...(taskIdentifiers === undefined ? {} : { taskIdentifiers }),
  });
  if (result.status === 'created' && !linkedProjectIds.includes(project.id)) {
    budget.immediateProjectIds.add(project.id);
  }
  return { kind: 'mounted', result };
};

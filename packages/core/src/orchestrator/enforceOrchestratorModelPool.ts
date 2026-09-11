import type { ModelEffort, ProviderId } from '@goodboy/types';
import { canonicalModelId } from '../providers/canonicalModelId';
import { defaultsForRole } from '../roles';
import type { OrchestratorModelOption, OrchestratorRoleDefault, OrchestratorStep } from './types';

export type OrchestratorModelRejection = {
  readonly requested: string;
  readonly appliedModel: string;
  readonly appliedEffort: ModelEffort;
  readonly note: string;
};

export type EnforcedOrchestratorStep = {
  readonly step: OrchestratorStep;
  readonly rejection: OrchestratorModelRejection | null;
};

type Params = {
  readonly provider: ProviderId;
  readonly step: OrchestratorStep;
  readonly pool: ReadonlyArray<OrchestratorModelOption>;
  readonly roleDefaults: ReadonlyArray<OrchestratorRoleDefault>;
};

export const enforceOrchestratorModelPool = ({
  provider,
  step,
  pool,
  roleDefaults,
}: Params): EnforcedOrchestratorStep => {
  const requested = step.model;
  if (requested == null) {
    return { step, rejection: null };
  }
  const requestedExecution = canonicalModelId({ provider, modelId: requested });
  const isAllowed = pool.some((option) => {
    if (option.id === requested) {
      return true;
    }
    if (requestedExecution == null) {
      return false;
    }
    return canonicalModelId({ provider, modelId: option.id }) === requestedExecution;
  });
  if (isAllowed) {
    return { step, rejection: null };
  }
  const configured = roleDefaults.find((entry) => entry.role === step.role);
  const fallback = defaultsForRole(step.role);
  const appliedModel = configured?.model ?? fallback.model;
  const appliedEffort = configured?.effort ?? fallback.effort;
  const poolLabel = pool.length === 0 ? 'nothing' : pool.map((option) => option.id).join(', ');
  return {
    step: { ...step, model: appliedModel, effort: appliedEffort },
    rejection: {
      requested,
      appliedModel,
      appliedEffort,
      note: `Routing corrected: ${requested} is outside the routing pool for this workspace (${poolLabel}), so this ${step.role} step runs on its configured default ${appliedModel} at ${appliedEffort} effort.`,
    },
  };
};

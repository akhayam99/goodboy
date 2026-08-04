import type { ModelEffort } from '@goodboy/types';
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
  readonly step: OrchestratorStep;
  readonly pool: ReadonlyArray<OrchestratorModelOption>;
  readonly roleDefaults: ReadonlyArray<OrchestratorRoleDefault>;
};

export const enforceOrchestratorModelPool = ({
  step,
  pool,
  roleDefaults,
}: Params): EnforcedOrchestratorStep => {
  const requested = step.model;
  if (requested == null) {
    return { step, rejection: null };
  }
  if (pool.some((option) => option.id === requested)) {
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

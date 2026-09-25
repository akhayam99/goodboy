import { clampEffortForModel, estimateDuration, type EstimateKey } from '@goodboy/core';
import type { AgentId, AgentRole, EffortLevel, StepSize } from '@goodboy/types';
import { estimateBasis, unknownEstimateBasis } from './estimateBasis';
import type { RowPhase } from './rowState';
import { workEstimateOf, workTime, type WorkEstimate, type WorkTime } from './workTime';
import { familyActiveTime, type WorkTimeSource } from './workTimeSource';

type KeyParams = {
  readonly role: AgentRole;
  readonly provider: string | null;
  readonly model: string | null;
  readonly effort: EffortLevel | null;
  readonly size: StepSize | null;
};

export const estimateKeyOf = ({ role, provider, model, effort, size }: KeyParams): EstimateKey => ({
  role,
  provider,
  model,
  effort: model === null || effort === null ? effort : clampEffortForModel({ model, effort }),
  size,
});

type EstimateParams = {
  readonly key: EstimateKey;
  readonly source: WorkTimeSource;
};

export const workEstimateFor = ({ key, source }: EstimateParams): WorkEstimate | null => {
  if (source.history === null) {
    return null;
  }
  const estimate = estimateDuration({ samples: source.history.steps, key, nowMs: source.nowMs });
  return estimate === null
    ? null
    : workEstimateOf({ estimate, basis: estimateBasis({ estimate, key }) });
};

type Params = {
  readonly agentId: AgentId;
  readonly key: EstimateKey;
  readonly phase: RowPhase;
  readonly source: WorkTimeSource;
};

export const agentWorkTime = ({ agentId, key, phase, source }: Params): WorkTime | null => {
  const active = familyActiveTime({ agentIds: [agentId], source });
  return workTime({
    phase,
    activeMs: active.activeMs,
    hasStarted: active.hasStarted,
    estimate: workEstimateFor({ key, source }),
    unknownBasis: source.history === null ? null : unknownEstimateBasis({ key }),
  });
};

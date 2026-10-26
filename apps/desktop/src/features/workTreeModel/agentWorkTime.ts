import {
  clampEffortForModel,
  estimateDuration,
  estimateProgress,
  type DurationHistory,
  type DurationUnit,
  type EstimateKey,
} from '@goodboy/core';
import type { AgentId, AgentRole, EffortLevel, StepSize } from '@goodboy/types';
import { providerIdOf } from '../../shared/utils/providerIdOf';
import { estimateBasis, unknownEstimateBasis } from './estimateBasis';
import type { RowPhase } from './rowState';
import {
  formatActiveTime,
  workEstimateOf,
  workTime,
  type WorkEstimate,
  type WorkTime,
} from './workTime';
import { agentActiveTime, type WorkTimeSource } from './workTimeSource';

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
  effort:
    model === null || effort === null
      ? effort
      : clampEffortForModel({ model, effort, provider: providerIdOf({ value: provider }) }),
  size,
});

type HistoryEstimateParams = {
  readonly key: EstimateKey;
  readonly unit: DurationUnit;
  readonly history: DurationHistory;
  readonly nowMs: number;
};

const historyWorkEstimate = ({
  key,
  unit,
  history,
  nowMs,
}: HistoryEstimateParams): WorkEstimate | null => {
  const estimate = estimateDuration({ history, unit, key, nowMs });
  return estimate === null
    ? null
    : workEstimateOf({ estimate, basis: estimateBasis({ estimate, key, unit }) });
};

type EstimateParams = {
  readonly key: EstimateKey;
  readonly unit: DurationUnit;
  readonly source: WorkTimeSource;
};

export const workEstimateFor = ({ key, unit, source }: EstimateParams): WorkEstimate | null =>
  source.history === null
    ? null
    : historyWorkEstimate({ key, unit, history: source.history, nowMs: source.nowMs });

type Params = {
  readonly agentId: AgentId;
  readonly key: EstimateKey;
  readonly unit: DurationUnit;
  readonly phase: RowPhase;
  readonly source: WorkTimeSource;
};

type TurnParams = Params & {
  readonly estimate: WorkEstimate | null;
  readonly unknownBasis: string | null;
};

const turnWorkTime = ({
  agentId,
  phase,
  source,
  estimate,
  unknownBasis,
}: TurnParams): WorkTime | null => {
  const active = agentActiveTime({ agentId, unit: 'turn', isRunning: phase === 'running', source });
  const isLiveTurn = phase === 'running' && source.liveStartMs.has(agentId);
  return workTime({
    phase,
    activeMs: active.activeMs,
    hasStarted: active.hasStarted,
    estimate: isLiveTurn || !active.hasStarted ? estimate : null,
    unknownBasis: isLiveTurn ? unknownBasis : null,
    quietMs: isLiveTurn ? (source.quietMs?.get(agentId) ?? null) : null,
  });
};

export const agentWorkTime = (params: Params): WorkTime | null => {
  const { agentId, key, unit, phase, source } = params;
  const estimate = workEstimateFor({ key, unit, source });
  const unknownBasis =
    source.history === null || estimate !== null
      ? null
      : unknownEstimateBasis({
          key,
          unit,
          progress: estimateProgress({ history: source.history, unit, key, nowMs: source.nowMs }),
        });
  if (unit === 'turn') {
    return turnWorkTime({ ...params, estimate, unknownBasis });
  }
  const active = agentActiveTime({ agentId, unit, isRunning: phase === 'running', source });
  return workTime({
    phase,
    activeMs: active.activeMs,
    hasStarted: active.hasStarted,
    estimate,
    unknownBasis,
  });
};

type ClockParams = {
  readonly agentId: AgentId;
  readonly unit: DurationUnit;
  readonly isRunning: boolean;
  readonly source: WorkTimeSource;
};

export const agentActiveClock = ({
  agentId,
  unit,
  isRunning,
  source,
}: ClockParams): string | null => {
  const active = agentActiveTime({ agentId, unit, isRunning, source });
  if (!active.hasStarted) {
    return null;
  }
  const label = formatActiveTime({ ms: active.activeMs });
  return label === '' ? null : label;
};

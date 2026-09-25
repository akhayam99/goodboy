import {
  estimateDuration,
  estimateOrchestratedRun,
  sumEstimates,
  type DurationEstimate,
  type DurationHistory,
} from '@goodboy/core';
import type { AgentRole, EffortLevel, StepSize } from '@goodboy/types';
import { estimateKeyOf } from '../../../workTreeModel/agentWorkTime';
import {
  estimateBasis,
  estimateBasisShort,
  unknownEstimateBasis,
} from '../../../workTreeModel/estimateBasis';
import {
  estimateRangeLabel,
  formatCostRange,
  isFallbackTier,
  plainWorkTime,
  workEstimateOf,
  type WorkTime,
} from '../../../workTreeModel/workTime';

export type PlanStepInput = {
  readonly key: string;
  readonly role: AgentRole;
  readonly provider: string;
  readonly model: string;
  readonly effort: EffortLevel | null;
  readonly size: StepSize | null;
};

export type PlanStepEstimate = {
  readonly time: WorkTime;
  readonly cost: string | null;
  readonly note: string | null;
};

export type PlanTotal = {
  readonly label: string;
  readonly detail: string;
};

export type PlanEstimates = {
  readonly steps: ReadonlyMap<string, PlanStepEstimate>;
  readonly total: PlanTotal | null;
};

type Params = {
  readonly history: DurationHistory | null;
  readonly steps: ReadonlyArray<PlanStepInput>;
  readonly isOrchestrated: boolean;
  readonly isReviewed: boolean;
  readonly nowMs: number;
};

const REVIEWS_NOTE = '+ your reviews';

const costOf = ({ estimate }: { readonly estimate: DurationEstimate }): string | null => {
  if (estimate.cost === null) {
    return null;
  }
  const range = formatCostRange(estimate.cost);
  return isFallbackTier({ tier: estimate.tier }) && !range.startsWith('≈') ? `~${range}` : range;
};

type TotalParams = {
  readonly history: DurationHistory;
  readonly nowMs: number;
};

const orchestratedTotal = ({ history, nowMs }: TotalParams): PlanTotal | null => {
  const estimate = estimateOrchestratedRun({ runs: history.orchestratedRuns, nowMs });
  if (estimate === null) {
    return null;
  }
  const range = estimateRangeLabel({
    estimate: workEstimateOf({ estimate, basis: '' }),
  }).replace(/^≈ /, '');
  return {
    label: `≈ ${range} machine time · ${estimate.sampleCount} past runs`,
    detail: `Based on ${estimate.sampleCount} past orchestrated runs in this workspace, last 90 days. Machine time only: waiting on you is not counted.`,
  };
};

export const planEstimates = ({
  history,
  steps,
  isOrchestrated,
  isReviewed,
  nowMs,
}: Params): PlanEstimates | null => {
  if (history === null) {
    return null;
  }
  if (isOrchestrated) {
    return { steps: new Map(), total: orchestratedTotal({ history, nowMs }) };
  }
  const byKey = new Map<string, PlanStepEstimate>();
  const estimates: Array<DurationEstimate | null> = [];
  for (const step of steps) {
    const key = estimateKeyOf(step);
    const estimate = estimateDuration({ history, unit: 'step', key, nowMs });
    estimates.push(estimate);
    if (estimate === null) {
      byKey.set(step.key, {
        time: plainWorkTime({ label: '–', detail: unknownEstimateBasis({ key, unit: 'step' }) }),
        cost: null,
        note: null,
      });
      continue;
    }
    const work = workEstimateOf({
      estimate,
      basis: estimateBasis({ estimate, key, unit: 'step' }),
    });
    const range = estimateRangeLabel({ estimate: work });
    const cost = costOf({ estimate });
    byKey.set(step.key, {
      time: plainWorkTime({ label: range, detail: `Usually ${range}. ${work.basis}` }),
      cost,
      note: [range, cost, estimateBasisShort({ estimate, key, unit: 'step' })]
        .filter((part) => part !== null)
        .join(' · '),
    });
  }
  if (estimates.every((estimate) => estimate === null)) {
    return null;
  }
  const sum = sumEstimates({ estimates });
  if (sum === null) {
    return { steps: byKey, total: null };
  }
  const range = estimateRangeLabel({
    estimate: {
      lowMs: sum.lowMs,
      midMs: (sum.lowMs + sum.highMs) / 2,
      highMs: sum.highMs,
      isFallback: false,
      basis: '',
    },
  }).replace(/^≈ /, '');
  const parts = [
    `≈ ${range}`,
    sum.cost === null ? null : formatCostRange(sum.cost).replace(/^≈ /, ''),
    isReviewed ? REVIEWS_NOTE : null,
  ].filter((part) => part !== null);
  return {
    steps: byKey,
    total: {
      label: parts.join(' · '),
      detail: `Adds the usual time of each step, from finished steps over the last 90 days, in this workspace first. Machine time only${isReviewed ? ': the time you take to review each step is not included' : ''}.`,
    },
  };
};

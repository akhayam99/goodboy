import {
  estimateDuration,
  estimateOrchestratedRun,
  sumEstimates,
  type DurationEstimate,
  type DurationHistory,
} from '@goodboy/core';
import type { AgentRole, EffortLevel } from '@goodboy/types';
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
  workEstimateOf,
  type WorkTime,
} from '../../../workTreeModel/workTime';

const PLAN_ESTIMATE_MIN_STEPS = 10;

export type PlanStepInput = {
  readonly key: string;
  readonly role: AgentRole;
  readonly provider: string;
  readonly model: string;
  readonly effort: EffortLevel | null;
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
  if (history.steps.length < PLAN_ESTIMATE_MIN_STEPS) {
    return null;
  }
  const byKey = new Map<string, PlanStepEstimate>();
  const estimates: Array<DurationEstimate | null> = [];
  for (const step of steps) {
    const key = estimateKeyOf(step);
    const estimate = estimateDuration({ samples: history.steps, key, nowMs });
    estimates.push(estimate);
    if (estimate === null) {
      byKey.set(step.key, {
        time: { label: '–', detail: unknownEstimateBasis({ key }), progress: null },
        cost: null,
        note: null,
      });
      continue;
    }
    const work = workEstimateOf({ estimate, basis: estimateBasis({ estimate, key }) });
    const range = estimateRangeLabel({ estimate: work });
    const cost = costOf({ estimate });
    byKey.set(step.key, {
      time: { label: range, detail: `Usually ${range}. ${work.basis}`, progress: null },
      cost,
      note: [range, cost, estimateBasisShort({ estimate, key })]
        .filter((part) => part !== null)
        .join(' · '),
    });
  }
  const sum = sumEstimates({ estimates });
  if (sum === null) {
    return { steps: byKey, total: null };
  }
  const range = estimateRangeLabel({
    estimate: {
      p25Ms: sum.p25Ms,
      p50Ms: (sum.p25Ms + sum.p75Ms) / 2,
      p75Ms: sum.p75Ms,
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
      detail: `Adds the usual time of each step, from finished steps in this workspace over the last 90 days. Machine time only${isReviewed ? ': the time you take to review each step is not included' : ''}.`,
    },
  };
};

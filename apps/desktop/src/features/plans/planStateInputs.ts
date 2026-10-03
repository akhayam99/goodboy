import type { PlanWithCount } from '@goodboy/types';
import {
  planPartsProgress,
  type PlanPartRow,
  type PlanPartsProgress,
} from './components/PlanParts/planPartRows';

export type PlanStateInputs = Readonly<{
  partCount: number;
  progress: PlanPartsProgress | null;
  hasPartAgents: boolean;
}>;

export const NO_PLAN_STATE_INPUTS: PlanStateInputs = {
  partCount: 0,
  progress: null,
  hasPartAgents: false,
};

export const planStateInputsOf = ({
  plan,
  rows,
}: {
  readonly plan: PlanWithCount;
  readonly rows: ReadonlyArray<PlanPartRow>;
}): PlanStateInputs => ({
  partCount: plan.clusters?.length ?? 0,
  progress:
    plan.status === 'consumed' && rows.length > 0
      ? planPartsProgress({ rows, hasRun: true })
      : null,
  hasPartAgents: rows.some((row) => row.agentId !== null),
});

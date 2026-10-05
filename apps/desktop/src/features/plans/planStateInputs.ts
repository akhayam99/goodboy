import type { PlanWithCount } from '@goodboy/types';
import {
  planPartsProgress,
  type PlanPartRow,
  type PlanPartsProgress,
} from './components/PlanParts/planPartRows';
import { NOT_REVISING, type PlanRevising } from './planRevising';

export type PlanStateInputs = Readonly<{
  partCount: number;
  progress: PlanPartsProgress | null;
  hasPartAgents: boolean;
  revising: PlanRevising;
}>;

export const NO_PLAN_STATE_INPUTS: PlanStateInputs = {
  partCount: 0,
  progress: null,
  hasPartAgents: false,
  revising: NOT_REVISING,
};

export const planStateInputsOf = ({
  plan,
  rows,
  revising = NOT_REVISING,
}: {
  readonly plan: PlanWithCount;
  readonly rows: ReadonlyArray<PlanPartRow>;
  readonly revising?: PlanRevising;
}): PlanStateInputs => ({
  partCount: plan.clusters?.length ?? 0,
  progress:
    plan.status === 'consumed' && rows.length > 0
      ? planPartsProgress({ rows, hasRun: true })
      : null,
  hasPartAgents: rows.some((row) => row.agentId !== null),
  revising,
});

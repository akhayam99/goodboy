import type { PlanWithCount } from '@goodboy/types';
import {
  planPartsProgress,
  type PlanPartRow,
  type PlanPartsProgress,
} from './components/PlanParts/planPartRows';
import type { PlanHandoff } from './planHandoffOf';
import { NOT_REVISING, type PlanRevising } from './planRevising';

export type PlanStateInputs = Readonly<{
  partCount: number;
  progress: PlanPartsProgress | null;
  hasPartAgents: boolean;
  revising: PlanRevising;
  plannerQuestionCount: number;
  handoff: PlanHandoff;
}>;

export const NO_PLAN_STATE_INPUTS: PlanStateInputs = {
  partCount: 0,
  progress: null,
  hasPartAgents: false,
  revising: NOT_REVISING,
  plannerQuestionCount: 0,
  handoff: 'none',
};

export const planStateInputsOf = ({
  plan,
  rows,
  revising = NOT_REVISING,
  plannerQuestionCount = 0,
  handoff = 'none',
}: {
  readonly plan: PlanWithCount;
  readonly rows: ReadonlyArray<PlanPartRow>;
  readonly revising?: PlanRevising;
  readonly plannerQuestionCount?: number;
  readonly handoff?: PlanHandoff;
}): PlanStateInputs => ({
  partCount: plan.clusters?.length ?? 0,
  progress:
    plan.status === 'consumed' && rows.length > 0
      ? planPartsProgress({ rows, hasRun: true })
      : null,
  hasPartAgents: rows.some((row) => row.agentId !== null),
  revising,
  plannerQuestionCount,
  handoff,
});

import type { PlanWithCount, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { planHandoffOf, type PlanHandoff } from '../../../plans/planHandoffOf';
import { usePlanOwner } from '../../../plans/usePlanOwner';

type Params = Readonly<{
  sessionId: SessionId;
  plan: PlanWithCount | null;
}>;

export const usePlanHandoff = ({ sessionId, plan }: Params): PlanHandoff => {
  const run = usePlanOwner({ sessionId, plan });
  const views = useAppStore((state) => state.autoTreeViews[sessionId] ?? EMPTY_ARRAY);
  return plan === null ? 'none' : planHandoffOf({ plan, run, views });
};

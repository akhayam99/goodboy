import { isPlanChangeRequest } from '../../../features/plans/isPlanChangeRequest';
import type { ActivePlan } from './activePlanOf';

const UNCHANGED_PLAN_NOTE =
  'The planner answered without changing the plan. Ask it to write the whole updated plan if you wanted a new version.';

type Params = Readonly<{
  before: ActivePlan | null;
  after: ActivePlan | null;
  userText: string;
  hasCaptureError: boolean;
}>;

export const unchangedPlanNote = ({
  before,
  after,
  userText,
  hasCaptureError,
}: Params): string | null => {
  if (before === null || hasCaptureError || !isPlanChangeRequest({ content: userText })) {
    return null;
  }
  const isSamePlan = after !== null && after.id === before.id && after.bodyMd === before.bodyMd;
  return isSamePlan ? UNCHANGED_PLAN_NOTE : null;
};

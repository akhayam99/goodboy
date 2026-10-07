import { StatusDot } from '@goodboy/ui';
import { planRevisingLabel, type PlanRevising } from '../../../plans/planRevising';

type Props = {
  readonly revising: PlanRevising;
};

export const PlanDrawerStateLine = ({ revising }: Props) => {
  if (revising.kind !== 'newVersion') {
    return null;
  }
  return (
    <p
      role="status"
      data-testid="plan-drawer-state-line"
      data-state={revising.kind}
      className="flex min-w-0 items-center gap-2 text-label text-info"
    >
      <StatusDot tone="info" size="sm" pulsing />
      <span className="min-w-0">{planRevisingLabel({ revising })}</span>
    </p>
  );
};

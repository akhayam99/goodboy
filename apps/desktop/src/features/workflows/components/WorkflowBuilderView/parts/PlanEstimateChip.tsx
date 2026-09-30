import { Tooltip } from '@goodboy/ui';
import type { PlanTotal } from '../planEstimates';

type Props = {
  readonly total: PlanTotal;
};

export const PlanEstimateChip = ({ total }: Props) => (
  <Tooltip content={total.detail}>
    <span
      data-testid="plan-estimate"
      className="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 text-secondary tabular-nums text-muted-foreground"
    >
      {total.label}
    </span>
  </Tooltip>
);

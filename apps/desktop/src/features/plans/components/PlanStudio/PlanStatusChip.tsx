import { Chip, cn, type Tone } from '@goodboy/ui';
import type { PlanStatus } from '@goodboy/types';

const PLAN_STATUS_TONE: Record<PlanStatus, Tone> = {
  active: 'warning',
  consumed: 'info',
  superseded: 'neutral',
  discarded: 'neutral',
};

const PLAN_STATUS_OVERRIDE: Partial<Record<PlanStatus, string>> = {
  discarded: 'bg-muted/60 text-muted-foreground/70 line-through',
};

type Props = {
  readonly status: PlanStatus;
};

export const PlanStatusChip = ({ status }: Props) => (
  <Chip
    tone={PLAN_STATUS_TONE[status]}
    size="xs"
    bordered={false}
    label={status}
    className={cn('shrink-0', PLAN_STATUS_OVERRIDE[status])}
  />
);

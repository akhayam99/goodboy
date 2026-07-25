import { cn, tintClasses, type Tone } from '@goodboy/ui';
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

const PLAN_STATUS_LABEL: Record<PlanStatus, string> = {
  active: 'active',
  consumed: 'consumed',
  superseded: 'superseded',
  discarded: 'discarded',
};

type Params = {
  readonly status: PlanStatus;
};

export const planStatusBadge = ({ status }: Params): { label: string; className: string } => {
  const tint = tintClasses(PLAN_STATUS_TONE[status]);
  return {
    label: PLAN_STATUS_LABEL[status],
    className: PLAN_STATUS_OVERRIDE[status] ?? cn(tint.bg, tint.text),
  };
};

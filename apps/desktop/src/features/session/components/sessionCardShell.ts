import { cn, tintClasses } from '@goodboy/ui';
import type { SessionAttentionReason, SessionStage } from '@goodboy/types';
import { ATTENTION_REASON_META } from '../session-stage';

type Params = {
  readonly stage: SessionStage;
  readonly attention?: SessionAttentionReason | null;
  readonly selected?: boolean;
  readonly active?: boolean;
  readonly dimmed?: boolean;
};

type RailParams = Pick<Params, 'stage' | 'attention'>;

export const sessionRail = ({ stage, attention = null }: RailParams): string | null => {
  if (stage === 'running') {
    return 'border-l-info/40 spin-rail spin-border-info';
  }
  if (stage === 'attention') {
    return tintClasses(attention === null ? 'warning' : ATTENTION_REASON_META[attention].tone).rail;
  }
  return null;
};

type RestBorderParams = Pick<Params, 'stage' | 'attention' | 'selected'>;

const restBorder = ({ stage, attention = null, selected }: RestBorderParams): string => {
  if (selected === true) {
    return cn('border-primary', tintClasses('primary').bgSoft);
  }
  const rail = sessionRail({ stage, attention });
  if (rail === null) {
    return 'border-border-soft hover:border-border';
  }
  return cn('border-border-soft', rail);
};

export const sessionCardShell = ({ stage, attention, selected, active, dimmed }: Params): string =>
  cn(
    'rounded-lg border border-l-2 bg-elevated text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
    active === true ? 'border-border shadow-sm' : restBorder({ stage, attention, selected }),
    dimmed === true && 'opacity-50',
  );

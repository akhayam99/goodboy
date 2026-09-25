import { cn, tintClasses, type Tone } from '@goodboy/ui';
import type { SessionAttentionReason, SessionStage } from '@goodboy/types';
import { ATTENTION_REASON_META } from '../session-stage';

type Params = {
  readonly stage: SessionStage;
  readonly attention?: SessionAttentionReason | null;
  readonly selected?: boolean;
  readonly active?: boolean;
  readonly dimmed?: boolean;
};

const RAIL: Record<Tone, string> = {
  success: 'border-l-success',
  info: 'border-l-info',
  warning: 'border-l-warning',
  danger: 'border-l-danger',
  primary: 'border-l-primary',
  merged: 'border-l-merged',
  draft: 'border-l-draft',
  neutral: 'border-l-border',
};

type RestBorderParams = Pick<Params, 'stage' | 'attention' | 'selected'>;

const restBorder = ({ stage, attention = null, selected }: RestBorderParams): string => {
  if (selected === true) {
    return cn('border-primary', tintClasses('primary').bgSoft);
  }
  if (stage === 'running') {
    return 'border-border-soft border-l-info/40 spin-rail spin-border-info';
  }
  if (stage === 'attention') {
    return cn(
      'border-border-soft',
      RAIL[attention === null ? 'warning' : ATTENTION_REASON_META[attention].tone],
    );
  }
  return 'border-border-soft hover:border-border';
};

export const sessionCardShell = ({ stage, attention, selected, active, dimmed }: Params): string =>
  cn(
    'rounded-lg border border-l-2 bg-elevated text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
    active === true ? 'border-border shadow-sm' : restBorder({ stage, attention, selected }),
    dimmed === true && 'opacity-50',
  );

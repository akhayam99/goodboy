import { cn, tintClasses, type Tone } from '@goodboy/ui';
import type { SessionAttentionReason, SessionStage } from '@goodboy/types';
import { ATTENTION_REASON_META, STAGE_TONE } from '../session-stage';

export type SessionTone = {
  readonly tone: Tone;
  readonly isBreathing: boolean;
};

type ToneParams = {
  readonly stage: SessionStage;
  readonly attention?: SessionAttentionReason | null;
};

export const sessionTone = ({ stage, attention = null }: ToneParams): SessionTone => {
  if (stage === 'attention' && attention !== null) {
    return { tone: ATTENTION_REASON_META[attention].tone, isBreathing: false };
  }
  return { tone: STAGE_TONE[stage], isBreathing: stage === 'running' };
};

type ShellParams = {
  readonly selected?: boolean;
  readonly active?: boolean;
  readonly dimmed?: boolean;
};

const restBorder = ({ selected }: Pick<ShellParams, 'selected'>): string => {
  if (selected === true) {
    return cn('border-primary', tintClasses('primary').bgSoft);
  }
  return 'border-border-soft hover:border-border';
};

export const sessionCardShell = ({ selected, active, dimmed }: ShellParams): string =>
  cn(
    'relative rounded-lg border bg-elevated text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
    active === true ? 'border-border shadow-sm' : restBorder({ selected }),
    dimmed === true && 'opacity-50',
  );

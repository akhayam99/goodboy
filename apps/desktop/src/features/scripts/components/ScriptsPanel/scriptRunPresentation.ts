import { cn, tintClasses, type Tone } from '@goodboy/ui';
import type { ScriptRunStatus } from '../../scripts';

export const SCRIPT_RUN_PRESENTATION = {
  idle: {
    borderClass: 'border-transparent',
    textClass: 'text-muted-foreground',
    motionClass: null,
    dotTone: 'neutral',
    dotLabel: null,
  },
  pending: {
    borderClass: cn(tintClasses('info').border),
    textClass: 'text-info',
    motionClass: 'spin-border spin-border-info',
    dotTone: 'info',
    dotLabel: 'Running',
  },
  ok: {
    borderClass: cn(tintClasses('success').border),
    textClass: 'text-success',
    motionClass: null,
    dotTone: 'success',
    dotLabel: 'Last run ok',
  },
  error: {
    borderClass: cn(tintClasses('danger').border),
    textClass: 'text-danger',
    motionClass: null,
    dotTone: 'danger',
    dotLabel: 'Last run failed',
  },
  cancelled: {
    borderClass: 'border-border',
    textClass: 'text-muted-foreground',
    motionClass: null,
    dotTone: 'neutral',
    dotLabel: 'Last run cancelled',
  },
} satisfies Record<
  ScriptRunStatus,
  {
    readonly borderClass: string;
    readonly textClass: string;
    readonly motionClass: string | null;
    readonly dotTone: Tone;
    readonly dotLabel: string | null;
  }
>;

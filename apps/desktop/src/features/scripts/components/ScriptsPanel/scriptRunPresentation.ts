import { cn, tintClasses, type Tone } from '@goodboy/ui';
import type { ScriptRunStatus } from '../../scripts';

export const SCRIPT_RUN_PRESENTATION = {
  idle: {
    statusLabel: 'Not run',
    borderClass: 'border-transparent',
    textClass: 'text-muted-foreground',
    motionClass: null,
    dotTone: 'neutral',
    dotLabel: null,
  },
  pending: {
    statusLabel: 'Running',
    borderClass: cn(tintClasses('info').border),
    textClass: 'text-info',
    motionClass: 'spin-border spin-border-info',
    dotTone: 'info',
    dotLabel: 'Running',
  },
  ok: {
    statusLabel: 'Passed',
    borderClass: cn(tintClasses('success').border),
    textClass: 'text-success',
    motionClass: null,
    dotTone: 'success',
    dotLabel: 'Last run passed',
  },
  error: {
    statusLabel: 'Failed',
    borderClass: cn(tintClasses('danger').border),
    textClass: 'text-danger',
    motionClass: null,
    dotTone: 'danger',
    dotLabel: 'Last run failed',
  },
  cancelled: {
    statusLabel: 'Stopped',
    borderClass: 'border-border',
    textClass: 'text-muted-foreground',
    motionClass: null,
    dotTone: 'neutral',
    dotLabel: 'Last run stopped',
  },
} satisfies Record<
  ScriptRunStatus,
  {
    readonly statusLabel: string;
    readonly borderClass: string;
    readonly textClass: string;
    readonly motionClass: string | null;
    readonly dotTone: Tone;
    readonly dotLabel: string | null;
  }
>;

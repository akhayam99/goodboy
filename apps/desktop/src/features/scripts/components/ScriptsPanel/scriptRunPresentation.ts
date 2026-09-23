import { cn, tintClasses } from '@goodboy/ui';
import type { ScriptRunStatus } from '../../scripts';

export const SCRIPT_RUN_PRESENTATION = {
  idle: {
    borderClass: 'border-transparent',
    textClass: 'text-muted-foreground',
    motionClass: null,
  },
  pending: {
    borderClass: cn(tintClasses('info').border),
    textClass: 'text-info',
    motionClass: 'spin-border spin-border-info',
  },
  ok: {
    borderClass: cn(tintClasses('success').border),
    textClass: 'text-success',
    motionClass: null,
  },
  error: {
    borderClass: cn(tintClasses('danger').border),
    textClass: 'text-danger',
    motionClass: null,
  },
  cancelled: {
    borderClass: 'border-border',
    textClass: 'text-muted-foreground',
    motionClass: null,
  },
} satisfies Record<
  ScriptRunStatus,
  {
    readonly borderClass: string;
    readonly textClass: string;
    readonly motionClass: string | null;
  }
>;

import { cn, tintClasses } from '@goodboy/ui';
import type { ScriptRunStatus } from '../../scripts';

export const SCRIPT_RUN_PRESENTATION = {
  idle: {
    borderClass: 'border-transparent',
    textClass: 'text-muted-foreground',
    pulseClass: null,
  },
  pending: {
    borderClass: cn(tintClasses('info').border),
    textClass: 'text-info',
    pulseClass: 'motion-safe:animate-pulse',
  },
  ok: {
    borderClass: cn(tintClasses('success').border),
    textClass: 'text-success',
    pulseClass: null,
  },
  error: {
    borderClass: cn(tintClasses('danger').border),
    textClass: 'text-danger',
    pulseClass: null,
  },
  cancelled: {
    borderClass: 'border-border',
    textClass: 'text-muted-foreground',
    pulseClass: null,
  },
} satisfies Record<
  ScriptRunStatus,
  {
    readonly borderClass: string;
    readonly textClass: string;
    readonly pulseClass: string | null;
  }
>;

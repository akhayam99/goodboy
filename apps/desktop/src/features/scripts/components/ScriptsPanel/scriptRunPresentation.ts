import type { ScriptRunStatus } from '../../scripts';

export const SCRIPT_RUN_PRESENTATION = {
  idle: {
    borderClass: 'border-transparent',
    textClass: 'text-muted-foreground',
    pulseClass: null,
  },
  pending: {
    borderClass: 'border-info/50',
    textClass: 'text-info',
    pulseClass: 'motion-safe:animate-pulse',
  },
  ok: {
    borderClass: 'border-success/40',
    textClass: 'text-success',
    pulseClass: null,
  },
  error: {
    borderClass: 'border-danger/40',
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

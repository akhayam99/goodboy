import type { Tone } from '@goodboy/ui';
import type { ScriptRunStatus } from '../../scripts';

export const SCRIPT_RUN_PRESENTATION = {
  idle: {
    tone: 'neutral',
    borderClass: 'border-border-soft',
    textClass: 'text-muted-foreground',
    pulseClass: null,
  },
  pending: {
    tone: 'info',
    borderClass: 'border-info/50',
    textClass: 'text-info',
    pulseClass: 'motion-safe:animate-pulse',
  },
  ok: {
    tone: 'success',
    borderClass: 'border-success/40',
    textClass: 'text-success',
    pulseClass: null,
  },
  error: {
    tone: 'danger',
    borderClass: 'border-danger/40',
    textClass: 'text-danger',
    pulseClass: null,
  },
  cancelled: {
    tone: 'neutral',
    borderClass: 'border-border',
    textClass: 'text-muted-foreground',
    pulseClass: null,
  },
} satisfies Record<
  ScriptRunStatus,
  {
    readonly tone: Tone;
    readonly borderClass: string;
    readonly textClass: string;
    readonly pulseClass: string | null;
  }
>;

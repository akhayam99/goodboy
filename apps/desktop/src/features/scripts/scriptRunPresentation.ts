import type { ScriptRunStatus } from './scripts';

export const SCRIPT_RUN_PRESENTATION = {
  idle: { statusLabel: 'Not run', textClass: 'text-muted-foreground' },
  pending: { statusLabel: 'Running', textClass: 'text-info' },
  ok: { statusLabel: 'Passed', textClass: 'text-success' },
  error: { statusLabel: 'Failed', textClass: 'text-danger' },
  cancelled: { statusLabel: 'Stopped', textClass: 'text-muted-foreground' },
} satisfies Record<
  ScriptRunStatus,
  {
    readonly statusLabel: string;
    readonly textClass: string;
  }
>;

import type { BootPhase } from '../store';

const PHASE_LABEL: Record<BootPhase, string> = {
  pending: 'starting…',
  migrating: 'running database migrations…',
  'loading-settings': 'loading settings…',
  'detecting-cli': 'detecting claude cli…',
  'loading-workspaces': 'loading workspaces…',
  'restoring-session': 'restoring last session…',
  ready: 'ready.',
  error: 'boot error',
};

const PHASE_ORDER: ReadonlyArray<BootPhase> = [
  'migrating',
  'loading-settings',
  'detecting-cli',
  'loading-workspaces',
  'restoring-session',
];

export function BootSplash({ phase, error }: { phase: BootPhase; error: string | null }) {
  const idx = PHASE_ORDER.indexOf(phase);
  const total = PHASE_ORDER.length;

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 bg-background text-foreground">
      <div className="text-sm font-semibold tracking-tight">kAY.am</div>
      <div className="flex w-72 flex-col gap-2">
        <p className="text-xs text-muted-foreground">{PHASE_LABEL[phase]}</p>
        <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{
              width: phase === 'ready' ? '100%' : `${Math.max(0, (idx / total) * 100)}%`,
            }}
          />
        </div>
        {error ? <p className="text-xs text-danger">{error}</p> : null}
      </div>
    </div>
  );
}

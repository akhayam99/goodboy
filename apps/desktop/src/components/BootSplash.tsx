import { useCallback } from 'react';
import type { BootPhase } from '../store';
import { openUrl } from '../editor';

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

const GITHUB_NEW_ISSUE_URL =
  'https://github.com/kay-am/kay-am/issues/new?template=bug_report.md&labels=bug%2Cboot&title=Boot+failure';

interface BootSplashProps {
  phase: BootPhase;
  error: string | null;
  onRetry?: () => void;
  onSkipProviderDetection?: () => void;
}

function BootErrorRecovery({
  error,
  phase,
  onRetry,
  onSkipProviderDetection,
}: {
  error: string;
  phase: BootPhase;
  onRetry?: () => void;
  onSkipProviderDetection?: () => void;
}) {
  const isDetectingCli = phase === 'detecting-cli' || phase === 'error';

  const openLogs = useCallback(() => {
    void openUrl('tauri://localhost/__log_dir__').catch(() => {
      void openUrl('about:blank');
    });
  }, []);

  const openIssue = useCallback(() => {
    const url = `${GITHUB_NEW_ISSUE_URL}&body=${encodeURIComponent(`**phase:** ${phase}\n\n**error:**\n\`\`\`\n${error}\n\`\`\``)}`;
    void openUrl(url);
  }, [error, phase]);

  const category =
    phase === 'migrating'
      ? 'database migration'
      : phase === 'loading-settings'
        ? 'settings load'
        : phase === 'detecting-cli'
          ? 'cli detection'
          : phase === 'loading-workspaces'
            ? 'workspace load'
            : phase === 'restoring-session'
              ? 'session restore'
              : 'initialization';

  return (
    <div
      role="alert"
      className="flex w-72 flex-col gap-3 rounded-lg border border-danger/30 bg-danger/5 p-4"
    >
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-danger">
          {category} failed
        </span>
        <p className="text-xs text-danger/80">{error}</p>
      </div>

      <div className="flex flex-col gap-2">
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-md border border-danger/30 bg-background px-3 py-1.5 text-xs font-medium text-danger motion-safe:transition-colors hover:bg-danger/10"
          >
            retry
          </button>
        ) : null}

        {isDetectingCli && onSkipProviderDetection ? (
          <button
            type="button"
            onClick={onSkipProviderDetection}
            className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground motion-safe:transition-colors hover:bg-muted"
          >
            skip provider detection
          </button>
        ) : null}

        <button
          type="button"
          onClick={openLogs}
          className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground motion-safe:transition-colors hover:bg-muted"
        >
          open logs
        </button>

        <button
          type="button"
          onClick={openIssue}
          className="text-left text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          report on github ↗
        </button>
      </div>
    </div>
  );
}

export function BootSplash({ phase, error, onRetry, onSkipProviderDetection }: BootSplashProps) {
  const idx = PHASE_ORDER.indexOf(phase);
  const total = PHASE_ORDER.length;

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 bg-background text-foreground">
      <div className="text-sm font-semibold tracking-tight">kAY.am</div>
      <div className="flex w-72 flex-col gap-2">
        <p className="text-xs text-muted-foreground">{PHASE_LABEL[phase]}</p>
        <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary motion-safe:transition-all"
            style={{
              width: phase === 'ready' ? '100%' : `${Math.max(0, (idx / total) * 100)}%`,
            }}
          />
        </div>
      </div>
      {error ? (
        <BootErrorRecovery
          error={error}
          phase={phase}
          onRetry={onRetry}
          onSkipProviderDetection={onSkipProviderDetection}
        />
      ) : null}
    </div>
  );
}

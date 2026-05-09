import { useCallback } from 'react';
import type { BootPhase } from '../store';
import { openUrl } from '../editor';
import { cn as uiCn } from '@kay-am/ui';

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
  const progressPct = phase === 'ready' ? 100 : Math.max(0, (idx / total) * 100);

  return (
    <div className="relative flex h-screen flex-col items-center justify-center gap-6 overflow-hidden bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(ellipse at 50% 35%, oklch(from var(--color-primary) l c h / 0.10) 0%, transparent 55%)',
        }}
      />

      <div className="flex flex-col items-center gap-3">
        <div
          aria-hidden
          className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-subtle ring-1 ring-border-soft"
        >
          <span
            className="absolute inset-0 rounded-2xl motion-safe:animate-ping"
            style={{ background: 'oklch(from var(--color-primary) l c h / 0.15)' }}
          />
          <span className="relative font-semibold tracking-tight text-foreground">k</span>
        </div>
        <div className="text-base font-semibold tracking-tight">kAY.am</div>
      </div>

      <div className="flex w-80 flex-col gap-2">
        <div className="flex items-center justify-between text-2xs uppercase tracking-[0.08em] text-muted-foreground">
          <span>{PHASE_LABEL[phase]}</span>
          <span className="font-mono text-muted-foreground/70">{Math.round(progressPct)}%</span>
        </div>
        <div className="h-0.5 w-full overflow-hidden rounded-full bg-muted/60">
          <div
            className="h-full rounded-full bg-primary motion-safe:transition-all motion-safe:duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <ul className="mt-2 flex flex-col gap-0.5">
          {PHASE_ORDER.map((p, i) => {
            const done = i < idx || phase === 'ready';
            const active = i === idx && phase !== 'ready';
            return (
              <li
                key={p}
                className={uiCn(
                  'flex items-center gap-2 text-2xs',
                  done
                    ? 'text-success/80'
                    : active
                      ? 'text-foreground'
                      : 'text-muted-foreground/40',
                )}
              >
                <span
                  aria-hidden
                  className={uiCn(
                    'inline-block h-1.5 w-1.5 rounded-full',
                    done
                      ? 'bg-success'
                      : active
                        ? 'bg-primary motion-safe:animate-pulse'
                        : 'bg-muted-foreground/30',
                  )}
                />
                <span className="truncate">{PHASE_LABEL[p]}</span>
              </li>
            );
          })}
        </ul>
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

import { useCallback, useEffect, useRef, useState } from 'react';
import type { BootPhase } from '../../../store';
import { openUrl } from '../../../shared/lib/editor';

const PHASE_LABEL: Record<BootPhase, string> = {
  pending: 'starting…',
  migrating: 'running migrations',
  'loading-settings': 'loading settings',
  'detecting-cli': 'detecting providers',
  'loading-workspaces': 'loading workspaces',
  'restoring-session': 'restoring session',
  ready: 'ready',
  error: 'error',
};

const PHASE_ORDER: ReadonlyArray<BootPhase> = [
  'migrating',
  'loading-settings',
  'detecting-cli',
  'loading-workspaces',
  'restoring-session',
];

const MIN_PHASE_MS = 500;

const GITHUB_NEW_ISSUE_URL =
  'https://github.com/kay-am/kay-am/issues/new?template=bug_report.md&labels=bug%2Cboot&title=Boot+failure';

interface BootSplashProps {
  phase: BootPhase;
  error: string | null;
  onRetry?: () => void;
  onSkipProviderDetection?: () => void;
}

function useDisplayPhase(realPhase: BootPhase): BootPhase {
  const [displayPhase, setDisplayPhase] = useState<BootPhase>(realPhase);
  const queueRef = useRef<BootPhase[]>([]);
  const scheduledRef = useRef(false);

  const drain = useRef<() => void>(() => undefined);
  drain.current = () => {
    const next = queueRef.current.shift();
    if (next === undefined) {
      scheduledRef.current = false;
      return;
    }
    setDisplayPhase(next);
    setTimeout(() => drain.current(), MIN_PHASE_MS);
  };

  useEffect(() => {
    queueRef.current.push(realPhase);
    if (!scheduledRef.current) {
      scheduledRef.current = true;
      drain.current();
    }
  }, [realPhase]);

  return displayPhase;
}

export function BootSplash({ phase, error, onRetry, onSkipProviderDetection }: BootSplashProps) {
  const displayPhase = useDisplayPhase(phase);
  const idx = PHASE_ORDER.indexOf(displayPhase);
  const total = PHASE_ORDER.length;
  const progressPct = (() => {
    if (displayPhase === 'ready') return 100;
    if (displayPhase === 'pending') return 0;
    return Math.round(((idx + 1) / total) * 100);
  })();

  return (
    <div className="relative flex h-screen flex-col items-center justify-center gap-10 overflow-hidden bg-background text-foreground">
      {/* ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(ellipse 60% 40% at 50% 30%, oklch(from var(--color-primary) l c h / 0.12) 0%, transparent 70%)',
        }}
      />

      {/* logo + wordmark */}
      <div className="flex flex-col items-center gap-4">
        <div className="relative flex h-20 w-20 items-center justify-center">
          <span
            aria-hidden
            className="absolute inset-0 rounded-[22px] motion-safe:animate-ping"
            style={{ background: 'oklch(from var(--color-primary) l c h / 0.10)' }}
          />
          <div
            className="relative flex h-full w-full items-center justify-center rounded-[22px] bg-subtle shadow-lg ring-1 ring-border-soft"
            style={{ boxShadow: '0 0 40px oklch(from var(--color-primary) l c h / 0.15)' }}
          >
            <span className="text-3xl font-bold tracking-tighter text-foreground">k</span>
          </div>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-lg font-bold tracking-tight">kAY.am</span>
          <span className="text-[11px] tracking-widest text-muted-foreground/60 uppercase">
            ai workspace orchestrator
          </span>
        </div>
      </div>

      {/* step list + progress */}
      <div className="flex w-64 flex-col gap-4">
        <ul className="flex flex-col gap-1 font-mono text-[11px]">
          {PHASE_ORDER.map((p, i) => {
            const done = displayPhase === 'ready' || i < idx;
            const active = i === idx && displayPhase !== 'ready' && displayPhase !== 'pending';
            const iconClass = (() => {
              if (done) return 'text-success';
              if (active) return 'text-primary';
              return 'text-muted-foreground/25';
            })();
            const iconGlyph = (() => {
              if (done) return '✓';
              if (active) return '›';
              return '·';
            })();
            const labelClass = (() => {
              if (done) return 'text-success/70';
              if (active) return 'text-foreground';
              return 'text-muted-foreground/25';
            })();
            return (
              <li key={p} className="flex items-center gap-2.5">
                <span className={iconClass}>{iconGlyph}</span>
                <span className={labelClass}>
                  {PHASE_LABEL[p]}
                  {active ? <BlinkCursor /> : null}
                </span>
              </li>
            );
          })}
        </ul>

        <div className="flex flex-col gap-1.5">
          <div className="relative h-[3px] w-full overflow-hidden rounded-full bg-muted/40">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-primary motion-safe:transition-all motion-safe:duration-700"
              style={{
                width: `${progressPct}%`,
                boxShadow: '0 0 8px oklch(from var(--color-primary) l c h / 0.6)',
              }}
            />
          </div>
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

function BlinkCursor() {
  return (
    <span aria-hidden className="ml-0.5 inline-block w-[5px] motion-safe:animate-pulse">
      _
    </span>
  );
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
      ? 'migration'
      : phase === 'loading-settings'
        ? 'settings'
        : phase === 'detecting-cli'
          ? 'cli detection'
          : phase === 'loading-workspaces'
            ? 'workspace load'
            : phase === 'restoring-session'
              ? 'session restore'
              : 'init';

  return (
    <div
      role="alert"
      className="flex w-64 flex-col gap-3 rounded-lg border border-danger/30 bg-danger/5 p-4 font-mono text-[11px]"
    >
      <div className="flex flex-col gap-1">
        <span className="text-danger">✗ {category} failed</span>
        <p className="leading-relaxed text-danger/70">{error}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="rounded border border-danger/30 bg-background px-3 py-1.5 text-danger motion-safe:transition-colors hover:bg-danger/10"
          >
            › retry
          </button>
        ) : null}

        {isDetectingCli && onSkipProviderDetection ? (
          <button
            type="button"
            onClick={onSkipProviderDetection}
            className="rounded border border-border px-3 py-1.5 text-muted-foreground motion-safe:transition-colors hover:bg-muted"
          >
            › skip provider detection
          </button>
        ) : null}

        <button
          type="button"
          onClick={openLogs}
          className="rounded border border-border px-3 py-1.5 text-muted-foreground motion-safe:transition-colors hover:bg-muted"
        >
          › open logs
        </button>

        <button
          type="button"
          onClick={openIssue}
          className="text-left text-muted-foreground/60 underline-offset-2 hover:underline"
        >
          report on github ↗
        </button>
      </div>
    </div>
  );
}

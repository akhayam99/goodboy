import { useCallback, useEffect, useRef, useState } from 'react';
import type { BootPhase } from '../../../store';
import { openUrl } from '../../../shared/lib/editor';
import { DogMascot } from '../../../shared/components/DogMascot';

const GITHUB_NEW_ISSUE_URL =
  'https://github.com/akhayam99/goodboy/issues/new?template=bug_report.md&labels=bug%2Cboot&title=Boot+failure';

type BootSplashProps = {
  phase: BootPhase;
  error: string | null;
  onRetry?: () => void;
  onSkipProviderDetection?: () => void;
  onFinished?: () => void;
};

// User-facing steps. Internal phases (migrations, settings, cli detection) are
// collapsed into the first one, users don't care about the difference.
type BootStep = {
  threshold: number;
  label: string;
};

const STEPS: ReadonlyArray<BootStep> = [
  { threshold: 33, label: 'Loading your workspaces' },
  { threshold: 66, label: 'Restoring last session' },
  { threshold: 99, label: 'Almost there' },
];

const LAST_STEP: BootStep = STEPS[STEPS.length - 1] ?? {
  threshold: 100,
  label: 'Almost there',
};

// Maps a real boot phase to the target % the animation should crawl toward.
// The animation always lerps smoothly, fast boots still play the full bar.
function targetForPhase(phase: BootPhase): number {
  switch (phase) {
    case 'pending':
    case 'migrating':
      return 30;
    case 'loading-settings':
      return 45;
    case 'detecting-cli':
      return 60;
    case 'loading-workspaces':
      return 78;
    case 'restoring-session':
      return 92;
    case 'ready':
      return 100;
    case 'error':
      return 0;
  }
}

const RATE_PER_MS = 0.06;

function useSmoothProgress(phase: BootPhase, hasError: boolean): number {
  const [pct, setPct] = useState(0);
  const targetRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (hasError) return;
    targetRef.current = targetForPhase(phase);
  }, [phase, hasError]);

  useEffect(() => {
    if (hasError) return undefined;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      setPct((curr) => {
        const target = targetRef.current;
        if (curr >= target) return curr;
        return Math.min(target, curr + dt * RATE_PER_MS);
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [hasError]);

  return pct;
}

function stepForProgress(pct: number): BootStep {
  return STEPS.find((s) => pct < s.threshold) ?? LAST_STEP;
}

export function BootSplash({
  phase,
  error,
  onRetry,
  onSkipProviderDetection,
  onFinished,
}: BootSplashProps) {
  const hasError = error != null;
  const pct = useSmoothProgress(phase, hasError);
  const step = stepForProgress(pct);
  const finishedRef = useRef(false);

  useEffect(() => {
    if (finishedRef.current || hasError) return;
    if (pct >= 100 && phase === 'ready') {
      finishedRef.current = true;
      onFinished?.();
    }
  }, [pct, phase, hasError, onFinished]);

  return (
    <div className="relative flex h-screen flex-col items-center justify-center gap-10 overflow-hidden bg-background text-foreground">
      {/* dot grid background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            'radial-gradient(circle, oklch(from var(--color-foreground) l c h / 0.06) 1px, transparent 1px)',
          backgroundSize: '18px 18px',
        }}
      />
      {/* radial vignette to keep focus center */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(ellipse 60% 40% at 50% 45%, transparent 0%, oklch(from var(--color-background) l c h / 0.9) 70%)',
        }}
      />

      {/* mascot + wordmark */}
      <div className="flex flex-col items-center gap-5">
        <div className="relative flex h-24 w-24 items-center justify-center text-primary">
          <span
            aria-hidden
            className="absolute inset-0 rounded-full motion-safe:animate-ping"
            style={{
              background: 'oklch(from var(--color-primary) l c h / 0.18)',
              animationDuration: '2.2s',
            }}
          />
          <div
            className="relative flex h-full w-full items-center justify-center rounded-full bg-subtle ring-1 ring-border-soft"
            style={{ boxShadow: '0 0 50px oklch(from var(--color-primary) l c h / 0.25)' }}
          >
            <DogMascot size={52} className="text-primary motion-safe:animate-pulse" />
          </div>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-lg font-bold tracking-tight">Goodboy</span>
          <span className="text-[11px] uppercase tracking-widest text-muted-foreground/60">
            workspace orchestrator for coding agents
          </span>
        </div>
      </div>

      {/* single message + progress bar */}
      {hasError ? null : (
        <div className="flex w-72 flex-col gap-3">
          <div className="flex h-5 items-center justify-center">
            <span
              key={step.label}
              className="text-xs text-muted-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"
            >
              {step.label}
              <BlinkCursor />
            </span>
          </div>
          <div className="relative h-[3px] w-full overflow-hidden rounded-full bg-muted/30">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-primary"
              style={{
                width: `${pct}%`,
                transition: 'width 120ms linear',
                boxShadow: '0 0 8px oklch(from var(--color-primary) l c h / 0.7)',
              }}
            />
          </div>
        </div>
      )}

      {hasError ? (
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

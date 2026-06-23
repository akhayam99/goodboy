import { useCallback, useEffect, useRef } from 'react';
import { Skeleton } from '@goodboy/ui';
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

export const BootSplash = ({
  phase,
  error,
  onRetry,
  onSkipProviderDetection,
  onFinished,
}: BootSplashProps) => {
  const hasError = error != null;
  const finishedRef = useRef(false);

  useEffect(() => {
    if (finishedRef.current || hasError) {
      return;
    }
    if (phase === 'ready') {
      finishedRef.current = true;
      onFinished?.();
    }
  }, [phase, hasError, onFinished]);

  if (hasError) {
    return (
      <div className="relative flex h-screen flex-col items-center justify-center gap-10 bg-background text-foreground">
        <BootBrand />
        <BootErrorRecovery
          error={error}
          phase={phase}
          onRetry={onRetry}
          onSkipProviderDetection={onSkipProviderDetection}
        />
      </div>
    );
  }

  return (
    <div
      className="flex h-screen flex-col bg-background text-foreground"
      role="status"
      aria-label="Loading Goodboy"
    >
      <div className="flex h-9 shrink-0 items-center justify-between px-3">
        <div className="flex items-center gap-1.5">
          <DogMascot size={15} className="shrink-0 text-foreground" />
          <span className="text-xs font-semibold tracking-tight text-foreground">Goodboy</span>
        </div>
        <Skeleton className="h-4 w-16 rounded-full" />
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="flex w-64 shrink-0 flex-col gap-3 p-3">
          <Skeleton className="h-7 w-full rounded-md" />
          <div className="flex flex-col gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full rounded-md" />
            ))}
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
          <Skeleton className="h-6 w-1/3 rounded-md" />
          <div className="flex flex-1 flex-col gap-2.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full rounded" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

function BootBrand() {
  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative flex h-24 w-24 items-center justify-center text-primary">
        <div
          className="relative flex h-full w-full items-center justify-center rounded-full bg-subtle ring-1 ring-border-soft"
          style={{ boxShadow: '0 0 50px oklch(from var(--color-primary) l c h / 0.25)' }}
        >
          <DogMascot size={52} className="text-primary" />
        </div>
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-lg font-bold tracking-tight">Goodboy</span>
        <span className="text-xs tracking-tight text-muted-foreground/60">
          workspace orchestrator for coding agents
        </span>
      </div>
    </div>
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

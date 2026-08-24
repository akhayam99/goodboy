import { useCallback, useEffect, useRef } from 'react';
import type { BootPhase } from '../../../store/types';
import { openUrl } from '../../../shared/lib/editor';
import { DATABASE_UNAVAILABLE_MESSAGE } from '../../../shared/lib/db';
import { DogMascot } from '../../../shared/components/DogMascot';
import { BootSlowNotice } from './BootSlowNotice';
import { useElapsedSincePhase } from './useElapsedSincePhase';

const GITHUB_NEW_ISSUE_URL =
  'https://github.com/akhayam99/goodboy/issues/new?template=bug_report.md&labels=bug%2Cboot&title=Boot+failure';
const BOOT_SLOW_AFTER_MS = 10_000;

const BOOT_PHASE_LABEL: Record<BootPhase, string> = {
  pending: 'starting up',
  migrating: 'updating your library',
  'loading-settings': 'loading settings',
  'detecting-cli': 'detecting agents',
  'loading-workspaces': 'loading workspaces',
  'restoring-session': 'restoring your session',
  ready: 'ready',
  error: 'something went wrong',
};

type BootSplashProps = {
  phase: BootPhase;
  error: string | null;
  onRetry?: () => void;
  onFinished?: () => void;
};

export const BootSplash = ({ phase, error, onRetry, onFinished }: BootSplashProps) => {
  const hasError = error != null;
  const finishedRef = useRef(false);
  const elapsedMs = useElapsedSincePhase({ phase });
  const isSlow = phase !== 'error' && phase !== 'ready' && elapsedMs >= BOOT_SLOW_AFTER_MS;

  useEffect(() => {
    document.getElementById('boot-shell')?.remove();
  }, []);

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
    const isDatabaseFailure = error === DATABASE_UNAVAILABLE_MESSAGE;
    return (
      <div className="relative flex h-screen flex-col items-center justify-center gap-10 bg-background text-foreground">
        <BootBrand />
        <BootErrorRecovery
          error={error}
          category={bootErrorCategory({ phase, isDatabaseFailure })}
          onRetry={isDatabaseFailure ? undefined : onRetry}
        />
      </div>
    );
  }

  return (
    <div
      className="relative flex h-screen flex-col items-center justify-center gap-8 bg-background text-foreground"
      role="status"
      aria-label="Loading Goodboy"
    >
      <BootBrand />
      <div className="flex flex-col items-center gap-3">
        <span className="text-2xs tracking-tight text-muted-foreground/50 motion-safe:animate-pulse">
          {BOOT_PHASE_LABEL[phase]}
        </span>
        {isSlow ? <BootSlowNotice elapsedMs={elapsedMs} onRetry={onRetry} /> : null}
      </div>
    </div>
  );
};

function BootBrand() {
  return (
    <div className="flex flex-col items-center gap-5">
      <DogMascot size={64} className="text-primary" />
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-lg font-bold tracking-tight">Goodboy</span>
        <span className="text-xs tracking-tight text-muted-foreground/60">
          workspace orchestrator for coding agents
        </span>
      </div>
    </div>
  );
}

type BootErrorCategoryParams = {
  readonly phase: BootPhase;
  readonly isDatabaseFailure: boolean;
};

export const bootErrorCategory = ({
  phase,
  isDatabaseFailure,
}: BootErrorCategoryParams): string => {
  if (isDatabaseFailure) {
    return 'database';
  }

  return phase === 'migrating'
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
};

function BootErrorRecovery({
  error,
  category,
  onRetry,
}: {
  error: string;
  category: string;
  onRetry?: () => void;
}) {
  const openIssue = useCallback(() => {
    const url = `${GITHUB_NEW_ISSUE_URL}&body=${encodeURIComponent(`**category:** ${category}\n\n**error:**\n\`\`\`\n${error}\n\`\`\`\n\nBoot timings for this launch are in \`~/.goodboy/boot-breadcrumbs.log\` (phase and timing only, no paths or credentials). Paste the last few lines if you can.`)}`;
    void openUrl(url);
  }, [error, category]);

  return (
    <div
      role="alert"
      className="flex w-64 flex-col gap-3 rounded-lg border border-danger/30 bg-danger/5 p-4 font-mono text-2xs"
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

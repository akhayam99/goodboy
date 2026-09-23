import { useEffect, useRef } from 'react';
import type { BootPhase } from '../../../store/types';
import { DATABASE_UNAVAILABLE_MESSAGE } from '../../../shared/lib/db';
import { BootBrand } from './BootBrand';
import { BootErrorRecovery } from './BootErrorRecovery';
import { BootSlowNotice } from './BootSlowNotice';
import { useElapsedSincePhase } from './useElapsedSincePhase';

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
        <span className="text-xs text-muted-foreground motion-safe:animate-soft-pulse">
          {BOOT_PHASE_LABEL[phase]}
        </span>
        {isSlow ? <BootSlowNotice elapsedMs={elapsedMs} onRetry={onRetry} /> : null}
      </div>
    </div>
  );
};

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
        ? 'CLI detection'
        : phase === 'loading-workspaces'
          ? 'workspace load'
          : phase === 'restoring-session'
            ? 'session restore'
            : 'init';
};

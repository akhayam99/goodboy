import { useEffect, useRef } from 'react';
import type { BootPhase } from '../../../store/slices/boot/state';
import { DATABASE_UNAVAILABLE_MESSAGE } from '../../../shared/lib/db';
import type { NewerDatabase } from '../../../shared/lib/newerDatabase';
import { BootBrand } from './BootBrand';
import { BootErrorRecovery } from './BootErrorRecovery';
import { DatabaseRecovery } from './DatabaseRecovery';
import { NewerDatabaseScreen } from './NewerDatabaseScreen';
import { BootSlowNotice } from './BootSlowNotice';
import { BootStage } from './BootStage';
import { prefersReducedMotion } from './prefersReducedMotion';
import { useElapsedSincePhase } from './useElapsedSincePhase';
import { useRevealWindow } from './useRevealWindow';

const BOOT_SLOW_AFTER_MS = 10_000;
const BAR_FILL_MS = 200;

type BootSplashProps = {
  phase: BootPhase;
  failedPhase?: BootPhase | null;
  error: string | null;
  newerDatabase?: NewerDatabase | null;
  onRetry?: () => void;
  onRestoreBackup?: () => Promise<void>;
  onQuit?: () => void;
  onFinished?: () => void;
};

export const BootSplash = ({
  phase,
  failedPhase = null,
  error,
  newerDatabase = null,
  onRetry,
  onRestoreBackup = async () => undefined,
  onQuit = () => undefined,
  onFinished,
}: BootSplashProps) => {
  const hasError = error != null;
  const finishedRef = useRef(false);
  const elapsedMs = useElapsedSincePhase({ phase });
  const isSlow = phase !== 'error' && phase !== 'ready' && elapsedMs >= BOOT_SLOW_AFTER_MS;

  useRevealWindow();

  useEffect(() => {
    document.getElementById('boot-shell')?.remove();
  }, []);

  useEffect(() => {
    if (finishedRef.current || hasError || phase !== 'ready') {
      return;
    }
    const timer = window.setTimeout(
      () => {
        finishedRef.current = true;
        onFinished?.();
      },
      prefersReducedMotion() ? 0 : BAR_FILL_MS,
    );
    return () => window.clearTimeout(timer);
  }, [phase, hasError, onFinished]);

  if (hasError && newerDatabase !== null) {
    return (
      <NewerDatabaseScreen
        restorableSnapshot={newerDatabase.restorableSnapshot}
        onRestore={onRestoreBackup}
        onQuit={onQuit}
      />
    );
  }

  if (hasError) {
    return (
      <div className="relative flex h-screen flex-col items-center justify-center gap-8 bg-backdrop-cover text-foreground">
        <BootBrand />
        {error === DATABASE_UNAVAILABLE_MESSAGE ? (
          <DatabaseRecovery error={error} />
        ) : (
          <BootErrorRecovery
            error={error}
            category={bootErrorCategory({ phase: failedPhase ?? phase })}
            onRetry={onRetry}
          />
        )}
      </div>
    );
  }

  return (
    <div
      className="relative h-screen bg-backdrop-cover text-foreground"
      role="status"
      aria-label="Loading Goodboy"
    >
      <BootStage phase={phase}>
        {isSlow ? <BootSlowNotice elapsedMs={elapsedMs} onRetry={onRetry} /> : null}
      </BootStage>
    </div>
  );
};

type BootErrorCategoryParams = {
  readonly phase: BootPhase;
};

export const bootErrorCategory = ({ phase }: BootErrorCategoryParams): string => {
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

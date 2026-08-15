import { useCallback, useState } from 'react';

type Props = {
  elapsedMs: number;
  onRetry?: () => void;
};

export const BootSlowNotice = ({ elapsedMs, onRetry }: Props) => {
  const [hasRequestedRestart, setHasRequestedRestart] = useState(false);

  const requestRestart = useCallback(() => {
    onRetry?.();
    setHasRequestedRestart(true);
  }, [onRetry]);

  return (
    <div className="flex flex-col items-center gap-1.5 text-2xs text-muted-foreground">
      <span>this is taking longer than usual</span>
      <span>{`${Math.floor(elapsedMs / 1_000)}s in this step`}</span>
      {onRetry !== undefined && !hasRequestedRestart ? (
        <button
          type="button"
          onClick={requestRestart}
          className="rounded border border-border-soft bg-background px-3 py-1.5 text-foreground motion-safe:transition-colors hover:bg-subtle"
        >
          restart
        </button>
      ) : null}
      {hasRequestedRestart ? <span>still working, give it a moment</span> : null}
    </div>
  );
};

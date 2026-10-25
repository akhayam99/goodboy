import { useCallback, useState } from 'react';
import { Button } from '@goodboy/ui';

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
    <div className="flex flex-col items-center gap-1 text-meta text-muted-foreground">
      <span>This is taking longer than usual</span>
      <span>{`${Math.floor(elapsedMs / 1_000)}s in this step`}</span>
      {onRetry !== undefined && !hasRequestedRestart ? (
        <Button variant="secondary" size="sm" onClick={requestRestart}>
          Restart
        </Button>
      ) : null}
      {hasRequestedRestart ? <span>Still working, give it a moment</span> : null}
    </div>
  );
};

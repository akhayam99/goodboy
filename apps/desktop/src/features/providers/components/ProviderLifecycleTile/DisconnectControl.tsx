import { useCallback, useEffect, useRef, useState } from 'react';
import { Tooltip } from '@goodboy/ui';
import { RotateCw } from 'lucide-react';

interface Props {
  readonly onDisconnect: () => void;
  readonly onRefresh: () => void;
  readonly refreshing: boolean;
  readonly disconnecting: boolean;
}

const CONFIRM_WINDOW_MS = 3_000;

// Two-tap disconnect to avoid a modal while still preventing a fat-finger
// signout. First tap arms a 3s confirmation window, second tap commits.
// Refresh button kept alongside so the user can manually re-check identity.
export function DisconnectControl({ onDisconnect, onRefresh, refreshing, disconnecting }: Props) {
  const [armed, setArmed] = useState(false);
  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const onClick = useCallback(() => {
    if (!armed) {
      setArmed(true);
      timerRef.current = window.setTimeout(() => setArmed(false), CONFIRM_WINDOW_MS);
      return;
    }
    clearTimer();
    setArmed(false);
    onDisconnect();
  }, [armed, clearTimer, onDisconnect]);

  return (
    <div className="flex w-full items-stretch gap-1.5">
      <Tooltip content="Re-check identity" side="top">
        <button
          type="button"
          aria-label="Re-check identity"
          disabled={refreshing}
          className="rounded-md border border-border-soft px-2 text-xs hover:bg-muted disabled:opacity-50"
          onClick={onRefresh}
        >
          <RotateCw size={12} className={refreshing ? 'animate-spin' : undefined} aria-hidden />
        </button>
      </Tooltip>
      <button
        type="button"
        disabled={disconnecting}
        className={
          armed
            ? 'flex-1 rounded-md border border-danger/40 bg-danger/5 py-1.5 text-center text-xs font-medium text-danger transition-colors hover:bg-danger/10 disabled:opacity-50'
            : 'flex-1 rounded-md border border-border-soft py-1.5 text-center text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50'
        }
        onClick={onClick}
      >
        {disconnecting ? 'Signing out…' : armed ? 'Click again to confirm' : 'Disconnect'}
      </button>
    </div>
  );
}

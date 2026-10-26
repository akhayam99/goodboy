import { useRef, useState } from 'react';
import { Button, formatError } from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { detachFromAuto } from '../detachFromAuto';

type Props = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly isTurnLive: boolean;
  readonly onOpenAuto: () => void;
};

const WAIT_REASON = 'Wait for the turn to end first.';

export const AdoptedNotice = ({ sessionId, agentId, isTurnLive, onOpenAuto }: Props) => {
  const [error, setError] = useState<string | null>(null);
  const [isDetaching, setIsDetaching] = useState(false);
  const isDetachingRef = useRef(false);

  const detach = async (): Promise<void> => {
    if (isDetachingRef.current) {
      return;
    }
    isDetachingRef.current = true;
    setIsDetaching(true);
    setError(null);
    try {
      const outcome = await detachFromAuto({ getState: useAppStore.getState, sessionId, agentId });
      if (outcome.kind !== 'detached') {
        setError(outcome.message);
      }
    } catch (cause) {
      setError(formatError(cause));
    } finally {
      isDetachingRef.current = false;
      setIsDetaching(false);
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 items-center gap-3 text-meta text-muted-foreground">
        <p className="min-w-0 flex-1">
          Moved to Auto. Auto decides what happens next, so you can read this chat but not write in
          it. Detach it to take it back.
        </p>
        <Button variant="secondary" size="sm" onClick={onOpenAuto}>
          Open Auto
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={isDetaching || isTurnLive}
          isBusy={isDetaching}
          title={isTurnLive ? WAIT_REASON : undefined}
          onClick={() => void detach()}
        >
          Detach from Auto
        </Button>
      </div>
      {error === null ? null : (
        <p role="alert" className="text-meta text-danger">
          {error}
        </p>
      )}
    </div>
  );
};

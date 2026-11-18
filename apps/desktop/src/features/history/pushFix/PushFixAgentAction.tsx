import { CHECK_STATE } from '../../../store/slices/notifications/errorRecovery';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@goodboy/ui';
import type { MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import type { PushContinuation } from '../../../store/slices/history/types';
import { usePushFix } from '../../../shared/hooks/usePushFix';
import { NAMES } from '../../../shared/utils/names';
import { PushFixStatusLine } from './PushFixStatusLine';

type Props = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly output: string;
  readonly pending?: string;
  readonly onSettled: PushContinuation['resume'];
};

export const PushFixAgentAction = ({ sessionId, mountId, output, pending, onSettled }: Props) => {
  const [isStarting, setIsStarting] = useState(false);
  const state = usePushFix({ sessionId, mountId, onSettled });
  const latest = useRef(onSettled);

  useEffect(() => {
    latest.current = onSettled;
  }, [onSettled]);

  const resume = useCallback(() => latest.current(), []);

  const start = async (): Promise<void> => {
    const store = useAppStore.getState();
    setIsStarting(true);
    try {
      await store.fixBranchPushWithAgent({
        sessionId,
        mountId,
        isForce: false,
        confirmedOnlyOnline: null,
        confirmedRemoteSha: null,
        message: output,
        onSettled: resume,
        ...(pending !== undefined && { pending }),
      });
    } catch (error) {
      await store.reportError({
        recovery: CHECK_STATE,
        title: "Couldn't start the agent.",
        error,
        sessionId,
      });
    } finally {
      setIsStarting(false);
    }
  };

  if (state.kind === 'working') {
    return (
      <div className="flex w-full min-w-0 flex-col">
        <PushFixStatusLine sessionId={sessionId} state={state} />
      </div>
    );
  }
  const isRetry = state.kind === 'failed' || state.kind === 'stopped';
  return (
    <>
      {isRetry && (
        <div className="flex w-full min-w-0 flex-col">
          <PushFixStatusLine sessionId={sessionId} state={state} />
        </div>
      )}
      <Button size="sm" variant="secondary" isBusy={isStarting} onClick={() => void start()}>
        {isRetry ? NAMES.retry : NAMES.fixPushWithAgent}
      </Button>
    </>
  );
};

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@goodboy/ui';
import type { MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import type { PushContinuation } from '../../store/slices/history/types';
import { usePushFix } from '../hooks/usePushFix';
import { NAMES } from '../utils/names';
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
      await store.reportError({ title: "Couldn't start the agent.", error, sessionId });
    } finally {
      setIsStarting(false);
    }
  };

  if (state.kind === 'working') {
    return <PushFixStatusLine sessionId={sessionId} state={state} />;
  }
  return (
    <>
      {state.kind === 'failed' && <PushFixStatusLine sessionId={sessionId} state={state} />}
      <Button size="sm" variant="secondary" isBusy={isStarting} onClick={() => void start()}>
        {NAMES.fixPushWithAgent}
      </Button>
    </>
  );
};

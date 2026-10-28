import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@goodboy/ui';
import type { MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { agentPlace } from '../../store/slices/navigation/place';
import { branchPushFixAgentOf } from '../../store/slices/history/branchPushFixAgentOf';
import { NAMES } from '../utils/names';

type Props = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly output: string;
  readonly pending?: string;
  readonly onSettled: () => void;
};

const WORKING_LABEL = 'An agent is fixing the push';
const OPEN_LABEL = 'Open the agent';

export const PushFixAgentAction = ({ sessionId, mountId, output, pending, onSettled }: Props) => {
  const [isStarting, setIsStarting] = useState(false);
  const agentId = useAppStore((state) =>
    branchPushFixAgentOf({ fixes: state.branchPushFixes, sessionId, mountId }),
  );
  const latest = useRef(onSettled);

  useEffect(() => {
    latest.current = onSettled;
  }, [onSettled]);

  const resume = useCallback((): void => latest.current(), []);

  const start = async (): Promise<void> => {
    const state = useAppStore.getState();
    setIsStarting(true);
    try {
      await state.fixBranchPushWithAgent({
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
      await state.reportError({ title: "Couldn't start the agent.", error, sessionId });
    } finally {
      setIsStarting(false);
    }
  };

  if (agentId !== null) {
    return (
      <>
        <span role="status" className="text-meta text-muted-foreground">
          {WORKING_LABEL}
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            useAppStore.getState().navigate({ to: agentPlace({ sessionId, agentId }) })
          }
        >
          {OPEN_LABEL}
        </Button>
      </>
    );
  }
  return (
    <Button size="sm" variant="secondary" isBusy={isStarting} onClick={() => void start()}>
      {NAMES.fixPushWithAgent}
    </Button>
  );
};

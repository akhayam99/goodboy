import { useState } from 'react';
import type { SessionId } from '@goodboy/types';
import { Button } from '@goodboy/ui';
import { useToast } from '../../../../../../shared/components/Toast';
import { useAppStore } from '../../../../../../store';
import { runningAgentCountOf } from '../../../../../../store/runtime/live-work/runningAgentCountOf';
import { stopAllMessageOf } from '../../../../stopAllMessageOf';
import { stopAllRunningAgents } from '../../../../stopAllRunningAgents';
import type { SessionRun } from '../../../../sessionRunsOf';

type Props = {
  readonly sessionId: SessionId;
  readonly runs: ReadonlyArray<SessionRun>;
};

const RESUME_FLOOR = 2;

const STOP_ALL_FLOOR = 2;

export const InProgressAction = ({ sessionId, runs }: Props) => {
  const resumeStoppedAgents = useAppStore((state) => state.resumeStoppedAgents);
  const reportError = useAppStore((state) => state.reportError);
  const runningCount = useAppStore((state) => runningAgentCountOf({ state, sessionId }));
  const { showToast } = useToast();
  const [isResuming, setIsResuming] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const needYou = runs.filter((run) => run.isWaiting).length;
  const stoppedByRestart = runs.filter((run) => run.isRestartStopped).length;

  const resume = async () => {
    if (isResuming) {
      return;
    }
    setIsResuming(true);
    try {
      await resumeStoppedAgents({ sessionId });
    } catch (error) {
      await reportError({ title: "Couldn't resume the stopped agents", error, sessionId });
    } finally {
      setIsResuming(false);
    }
  };

  const stopAll = async () => {
    if (isStopping) {
      return;
    }
    setIsStopping(true);
    try {
      const result = await stopAllRunningAgents({
        getState: useAppStore.getState,
        sessionId,
      });
      showToast({ kind: 'info', message: stopAllMessageOf({ result }) });
    } finally {
      setIsStopping(false);
    }
  };

  return (
    <>
      {needYou === 0 ? null : (
        <span>
          {needYou} {needYou === 1 ? 'needs' : 'need'} you
        </span>
      )}
      {runningCount < STOP_ALL_FLOOR ? null : (
        <Button variant="quiet" size="xs" isBusy={isStopping} onClick={() => void stopAll()}>
          Stop all ({runningCount})
        </Button>
      )}
      {stoppedByRestart < RESUME_FLOOR ? null : (
        <Button variant="quiet" size="xs" isBusy={isResuming} onClick={() => void resume()}>
          Resume all
        </Button>
      )}
    </>
  );
};

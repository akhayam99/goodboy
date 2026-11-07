import { CHECK_STATE } from '../../../../../../store/slices/notifications/errorRecovery';
import { useState } from 'react';
import type { SessionId } from '@goodboy/types';
import { Button } from '@goodboy/ui';
import { NAMES } from '../../../../../../shared/utils/names';
import { useAppStore } from '../../../../../../store';
import type { SessionRun } from '../../../../sessionRunsOf';

type Props = {
  readonly sessionId: SessionId;
  readonly runs: ReadonlyArray<SessionRun>;
};

const RESUME_FLOOR = 2;

export const ContinueAllAction = ({ sessionId, runs }: Props) => {
  const resumeStoppedAgents = useAppStore((state) => state.resumeStoppedAgents);
  const reportError = useAppStore((state) => state.reportError);
  const [isResuming, setIsResuming] = useState(false);
  const stoppedByRestart = runs.filter((run) => run.isRestartStopped).length;

  const resume = async () => {
    if (isResuming) {
      return;
    }
    setIsResuming(true);
    try {
      await resumeStoppedAgents({ sessionId });
    } catch (error) {
      await reportError({
        recovery: CHECK_STATE,
        title: "Couldn't continue the stopped agents",
        error,
        sessionId,
      });
    } finally {
      setIsResuming(false);
    }
  };

  if (stoppedByRestart < RESUME_FLOOR) {
    return null;
  }
  return (
    <Button variant="quiet" size="xs" isBusy={isResuming} onClick={() => void resume()}>
      {NAMES.continueAll}
    </Button>
  );
};

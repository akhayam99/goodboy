import { useEffect, useState } from 'react';
import { useSessionById } from '../../../../../store';
import { SessionWorkspace } from '../../../../../features/session/components/SessionWorkspace';
import { SessionFrame } from '../../../SessionRail/SessionFrame';
import { BLOCKED_MOUNT_SESSION_ID } from '../u30/blockedMountStepSeed';
import { BUDGET_STOP, seedStoppedQuestions } from './stoppedQuestionsSeed';

export const StoppedQuestionsScene = () => {
  const [isSeeded, setIsSeeded] = useState(false);
  const session = useSessionById(BLOCKED_MOUNT_SESSION_ID);

  useEffect(() => {
    seedStoppedQuestions({ stop: BUDGET_STOP });
    setIsSeeded(true);
  }, []);

  if (!isSeeded || session === null) {
    return null;
  }

  return (
    <div
      data-shot
      style={{ width: 680, height: 900 }}
      className="flex min-h-0 bg-background text-foreground"
    >
      <div className="flex min-h-0 min-w-0 flex-1 p-6">
        <SessionFrame session={session}>
          <SessionWorkspace session={session} isActive />
        </SessionFrame>
      </div>
    </div>
  );
};

import { useEffect, useState } from 'react';
import { useAppStore, useSessionById } from '../../../../../store';
import { BLOCKED_MOUNT_RUN_ID, BLOCKED_MOUNT_SESSION_ID } from '../u30/blockedMountStepSeed';
import { StoppedRunTail } from './StoppedRunTail';
import { BUDGET_STOP, seedStoppedQuestions } from './stoppedQuestionsSeed';

export const StoppedQuestionsScene = () => {
  const [isSeeded, setIsSeeded] = useState(false);
  const session = useSessionById(BLOCKED_MOUNT_SESSION_ID);
  const run = session?.workflowRuns.find((candidate) => candidate.id === BLOCKED_MOUNT_RUN_ID);
  const workflow = useAppStore((state) =>
    (state.sessionWorkflows[BLOCKED_MOUNT_SESSION_ID] ?? []).find(
      (candidate) => candidate.id === run?.workflowId,
    ),
  );

  useEffect(() => {
    seedStoppedQuestions({ stop: BUDGET_STOP });
    setIsSeeded(true);
  }, []);

  if (!isSeeded || session == null || run === undefined || workflow === undefined) {
    return null;
  }

  return (
    <div data-shot style={{ width: 680 }} className="flex bg-background text-foreground">
      <StoppedRunTail session={session} run={run} workflow={workflow} />
    </div>
  );
};

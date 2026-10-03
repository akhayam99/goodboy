import { useState } from 'react';
import { Pause, Play } from 'lucide-react';
import type { Agent, SessionId, WorkflowRun } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { isRunPaused } from '../../isRunPaused';
import { OrchestratorAction } from '../OrchestratorStrip/OrchestratorAction';
import { RunControlMenu } from './RunControlMenu';
import { RunStopButton } from './RunStopButton';

type AutonomyMenu = {
  readonly label: string;
  readonly onAutoRun: (autoRun: boolean) => void;
};

type Props = {
  readonly sessionId: SessionId;
  readonly run: WorkflowRun;
  readonly agents: ReadonlyArray<Agent>;
  readonly isOrchestrating: boolean;
  readonly isRunOver: boolean;
  readonly autonomyMenu?: AutonomyMenu | null;
};

export const RunControls = ({
  sessionId,
  run,
  agents,
  isOrchestrating,
  isRunOver,
  autonomyMenu = null,
}: Props) => {
  const pauseWorkflowRun = useAppStore((state) => state.pauseWorkflowRun);
  const resumeWorkflowRun = useAppStore((state) => state.resumeWorkflowRun);
  const stopWorkflowRunNow = useAppStore((state) => state.stopWorkflowRunNow);
  const [isBusy, setIsBusy] = useState(false);
  const isPaused = isRunPaused({ run });
  const isStopped = run.orchestrationStop?.kind === 'operator';
  const hasStepInFlight = agents.some((agent) => agent.status === 'running');
  const isLive = isOrchestrating || hasStepInFlight;
  if (isRunOver || isStopped || run.discardedAt != null) {
    return null;
  }

  const guard = async (action: () => Promise<void>) => {
    if (isBusy) {
      return;
    }
    setIsBusy(true);
    try {
      await action();
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <>
      {isPaused ? (
        <OrchestratorAction
          icon={Play}
          label="Resume"
          variant="primary"
          testId="run-resume"
          title="Start where the run left off"
          disabled={isBusy}
          onClick={() => void guard(() => resumeWorkflowRun(sessionId, run.id))}
        />
      ) : null}
      {!isPaused && isLive ? (
        <OrchestratorAction
          icon={Pause}
          label="Pause"
          variant="secondary"
          testId="run-pause"
          title="Finish the step in flight and start no others"
          disabled={isBusy}
          onClick={() => void guard(() => pauseWorkflowRun(sessionId, run.id))}
        />
      ) : null}
      {isPaused || isLive ? (
        <RunStopButton
          hasStepInFlight={hasStepInFlight}
          disabled={isBusy}
          onStop={() => void guard(() => stopWorkflowRunNow(sessionId, run.id))}
        />
      ) : null}
      {autonomyMenu === null ? null : (
        <RunControlMenu
          label={autonomyMenu.label}
          autoRun={run.autoRun === true}
          onAutoRun={autonomyMenu.onAutoRun}
        />
      )}
    </>
  );
};

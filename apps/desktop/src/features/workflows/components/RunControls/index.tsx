import { useState } from 'react';
import { Check, Pause, Play } from 'lucide-react';
import type { Agent, SessionId, WorkflowAutonomy, WorkflowRun } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { isRunPaused } from '../../isRunPaused';
import { runAutonomyOf } from '../../runAutonomy';
import { OrchestratorAction } from '../OrchestratorStrip/OrchestratorAction';
import { RunControlMenu } from './RunControlMenu';
import { RunStopButton } from './RunStopButton';

type AutonomyMenu = {
  readonly label: string;
  readonly onAutonomy: (autonomy: WorkflowAutonomy) => void;
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
  const approveWorkflowRunPlan = useAppStore((state) => state.approveWorkflowRunPlan);
  const stopWorkflowRunNow = useAppStore((state) => state.stopWorkflowRunNow);
  const [isBusy, setIsBusy] = useState(false);
  const isPaused = isRunPaused({ run });
  const isHeldForPlan = run.orchestrationStop?.kind === 'plan-approval';
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
      {isHeldForPlan ? (
        <OrchestratorAction
          icon={Check}
          label="Approve plan"
          variant="primary"
          testId="run-approve-plan"
          title="Approve the plan and let the rest run on its own"
          disabled={isBusy}
          onClick={() =>
            void guard(async () => {
              await approveWorkflowRunPlan(sessionId, run.id);
            })
          }
        />
      ) : null}
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
      {isPaused || isHeldForPlan || isLive ? (
        <RunStopButton
          hasStepInFlight={hasStepInFlight}
          disabled={isBusy}
          onStop={() => void guard(() => stopWorkflowRunNow(sessionId, run.id))}
        />
      ) : null}
      {autonomyMenu === null ? null : (
        <RunControlMenu
          label={autonomyMenu.label}
          autonomy={
            runAutonomyOf({ autoRun: run.autoRun, autonomy: run.rulesSnapshot?.autonomy }).key
          }
          onAutonomy={autonomyMenu.onAutonomy}
        />
      )}
    </>
  );
};

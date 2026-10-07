import { CircleStop } from 'lucide-react';
import { ConfirmPopover } from '@goodboy/ui';
import type { Agent, SessionId, WorkflowRunId } from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useAppStore } from '../../../../store/store';
import { OrchestratorAction } from './OrchestratorAction';

type Props = {
  readonly sessionId: SessionId;
  readonly runId: WorkflowRunId;
  readonly agent: Agent;
  readonly disabled: boolean;
};

export const StopStepButton = ({ sessionId, runId, agent, disabled }: Props) => {
  const stopWorkflowRunNow = useAppStore((state) => state.stopWorkflowRunNow);

  return (
    <ConfirmPopover
      role="danger"
      icon={<CircleStop size={ICON_SIZE.control} aria-hidden />}
      title={`Stop ${agent.name}?`}
      description="The step is cancelled and marked Skipped. What it wrote is kept."
      confirmLabel="Stop step"
      align="end"
      onConfirm={() => void stopWorkflowRunNow(sessionId, runId)}
      trigger={({ arm }) => (
        <OrchestratorAction
          icon={CircleStop}
          label="Stop step"
          variant="ghost"
          tone="danger"
          testId="orchestrator-stop-step"
          title="Cancel the step in flight, the run waits for you"
          disabled={disabled}
          onClick={arm}
        />
      )}
    />
  );
};

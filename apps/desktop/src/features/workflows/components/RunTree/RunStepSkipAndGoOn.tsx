import { useState } from 'react';
import { Button } from '@goodboy/ui';
import type { Agent, WorkflowRunId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { STUCK_ACTION_LABEL } from './STUCK_ACTION_LABEL';

type Props = {
  readonly agent: Agent;
  readonly workflowRunId: WorkflowRunId;
};

export const RunStepSkipAndGoOn = ({ agent, workflowRunId }: Props) => {
  const skipStuckStepAndAdvance = useAppStore((state) => state.skipStuckStepAndAdvance);
  const [isBusy, setIsBusy] = useState(false);

  const skip = async (): Promise<void> => {
    setIsBusy(true);
    try {
      await skipStuckStepAndAdvance(agent.sessionId, workflowRunId, { agentId: agent.id });
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Button
      variant="secondary"
      size="sm"
      className="h-6 shrink-0"
      disabled={isBusy}
      aria-label={`${STUCK_ACTION_LABEL.skipAndGoOn} after ${agent.name}`}
      onClick={() => void skip()}
    >
      {STUCK_ACTION_LABEL.skipAndGoOn}
    </Button>
  );
};

import { useState } from 'react';
import { Button, formatError } from '@goodboy/ui';
import type { Agent } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { STUCK_ACTION_LABEL } from './STUCK_ACTION_LABEL';

type Props = {
  readonly agent: Agent;
};

export const RunStepKeepWorking = ({ agent }: Props) => {
  const keepWorkingOnStep = useAppStore((state) => state.keepWorkingOnStep);
  const emitNotification = useAppStore((state) => state.emitNotification);
  const [isBusy, setIsBusy] = useState(false);

  const keepWorking = async (): Promise<void> => {
    setIsBusy(true);
    try {
      await keepWorkingOnStep({ sessionId: agent.sessionId, agentId: agent.id });
    } catch (error) {
      void emitNotification({
        kind: 'error',
        severity: 'warning',
        title: "Couldn't keep working",
        body: formatError(error),
        sessionId: agent.sessionId,
      });
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-6 shrink-0"
      disabled={isBusy}
      aria-label={`${STUCK_ACTION_LABEL.keepWorking} on ${agent.name}`}
      onClick={() => void keepWorking()}
    >
      {STUCK_ACTION_LABEL.keepWorking}
    </Button>
  );
};

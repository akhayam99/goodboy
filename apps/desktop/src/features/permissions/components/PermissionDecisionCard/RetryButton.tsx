import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button, ICON_SIZE, Tooltip } from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';

type Props = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly toolName: string;
};

export const RetryButton = ({ sessionId, agentId, toolName }: Props) => {
  const retryBlockedTool = useAppStore((s) => s.retryBlockedTool);
  const isRunning = useAppStore((s) => s.agentTurnState[agentId]?.kind === 'running');
  const reportError = useAppStore((s) => s.reportError);
  const [isBusy, setIsBusy] = useState(false);
  const [hasSent, setHasSent] = useState(false);

  const handle = async () => {
    if (isBusy) {
      return;
    }
    setIsBusy(true);
    try {
      await retryBlockedTool({ sessionId, agentId, toolName });
      setHasSent(true);
    } catch (err) {
      void reportError({ title: `Couldn't continue after ${toolName}`, error: err, sessionId });
    } finally {
      setIsBusy(false);
    }
  };

  if (hasSent) {
    return <span className="text-meta text-muted-foreground">Continuing</span>;
  }

  return (
    <Tooltip content="Start a new turn so the agent retries the call with the new rule in place">
      <Button
        variant="secondary"
        size="xs"
        isBusy={isBusy}
        disabled={isRunning}
        onClick={() => void handle()}
      >
        <RotateCcw size={ICON_SIZE.mark} aria-hidden />
        Continue
      </Button>
    </Tooltip>
  );
};

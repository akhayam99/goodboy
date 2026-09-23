import { cn as tokenCn, tintClasses as tokenTintClasses } from '@goodboy/ui';
import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { cn } from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useToast } from '../../../../app/components/Toast';

type Props = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly toolName: string;
};

export const RetryButton = ({ sessionId, agentId, toolName }: Props) => {
  const retryBlockedTool = useAppStore((s) => s.retryBlockedTool);
  const isRunning = useAppStore((s) => s.agentTurnState[agentId]?.kind === 'running');
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const handle = async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      await retryBlockedTool({ sessionId, agentId, toolName });
      setSent(true);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'retry failed');
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return <span className="text-2xs text-muted-foreground">retry sent</span>;
  }

  const disabled = busy || isRunning;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => void handle()}
      title="Re-run the turn so the agent retries the tool with the new rule in place"
      className={cn(
        tokenCn(
          'flex items-center gap-1 rounded border',
          tokenTintClasses('primary').border,
          'px-2 py-0.5 text-2xs font-medium text-primary transition-colors',
          tokenTintClasses('primary').hoverBg,
        ),
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <RotateCcw size={10} aria-hidden />
      retry {toolName}
    </button>
  );
};

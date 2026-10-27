import { Square } from 'lucide-react';
import { GhostActionButton } from '@goodboy/ui';
import type { Agent, SessionId } from '@goodboy/types';
import { useAgentStop } from '../../../../shared/hooks/useAgentStop';
import { useAppStore } from '../../../../store';
import { useTailClock } from '../../../live-state/useTailClock';

type Props = {
  readonly sessionId: SessionId;
  readonly agent: Agent;
};

export const AgentLiveChip = ({ sessionId, agent }: Props) => {
  const turn = useAppStore((state) => state.agentTurnState[agent.id] ?? null);
  const { phase, stop } = useAgentStop({ sessionId, agentId: agent.id });
  const clock = useTailClock({
    startedAt: turn?.kind === 'running' ? turn.startedAt : null,
    stepAgentId: null,
    isTicking: turn?.kind === 'running',
    isRunning: turn?.kind === 'running',
  });
  if (turn?.kind !== 'running') {
    return null;
  }
  const word = phase === 'idle' ? 'Running' : phase === 'stopping' ? 'Stopping' : 'Still stopping';
  return (
    <span data-agent-live="" className="inline-flex items-center gap-1 text-meta">
      <span className="text-muted-foreground">{word}</span>
      {clock === null ? null : (
        <span aria-hidden className="tabular-nums text-faint-foreground">
          {clock}
        </span>
      )}
      <span aria-hidden className="text-faint-foreground">
        ·
      </span>
      <GhostActionButton
        icon={Square}
        label={phase === 'stalled' ? 'Force stop' : 'Stop'}
        isBusy={phase === 'stopping'}
        busyLabel="Stopping"
        onClick={stop}
      />
    </span>
  );
};

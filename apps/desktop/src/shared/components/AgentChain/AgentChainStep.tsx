import type { Agent, SessionId } from '@goodboy/types';
import { Button, StatusDot } from '@goodboy/ui';
import { useAppStore } from '../../../store';
import { agentPlace } from '../../../store/slices/navigation/place';

type Props = {
  readonly sessionId: SessionId;
  readonly name: string;
  readonly agent: Agent;
  readonly isRunning: boolean;
};

export const AgentChainStep = ({ sessionId, name, agent, isRunning }: Props) => {
  const navigate = useAppStore((state) => state.navigate);
  return (
    <li className="flex items-center gap-2">
      <StatusDot
        tone={isRunning ? 'warning' : agent.status === 'failed' ? 'danger' : 'success'}
        pulsing={isRunning}
        size="sm"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-row text-foreground">{name}</span>
        <span className="text-meta text-muted-foreground">
          {agent.name} · {isRunning ? 'Running' : agent.status}
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        aria-label={`Open agent ${agent.name}`}
        onClick={() => navigate({ to: agentPlace({ sessionId, agentId: agent.id }) })}
      >
        Open agent
      </Button>
    </li>
  );
};

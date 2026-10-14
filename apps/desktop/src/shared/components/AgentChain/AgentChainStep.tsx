import type { Agent, SessionId } from '@goodboy/types';
import { Button, StatusDot } from '@goodboy/ui';
import { useAppStore } from '../../../store';
import { agentPlace } from '../../../store/slices/navigation/place';

type Props = {
  readonly sessionId: SessionId;
  readonly name: string;
  readonly agent: Agent | null;
  readonly isRunning: boolean;
  readonly detail?: string;
  readonly tone?: 'success' | 'warning' | 'danger' | 'neutral';
  readonly linkLabel?: string;
};

export const AgentChainStep = ({
  sessionId,
  name,
  agent,
  isRunning,
  detail,
  tone,
  linkLabel,
}: Props) => {
  const navigate = useAppStore((state) => state.navigate);
  const resolvedTone =
    tone ?? (isRunning ? 'warning' : agent?.status === 'failed' ? 'danger' : 'success');
  return (
    <li className="flex items-center gap-2">
      <StatusDot tone={resolvedTone} pulsing={isRunning} size="sm" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-row text-foreground">{name}</span>
        <span className="text-meta text-muted-foreground">
          {detail ??
            (agent === null ? '' : `${agent.name} · ${isRunning ? 'Running' : agent.status}`)}
        </span>
      </div>
      {agent === null ? null : (
        <Button
          variant="ghost"
          size="sm"
          aria-label={
            linkLabel === undefined ? `Open agent ${agent.name}` : `${linkLabel} of ${agent.name}`
          }
          onClick={() => navigate({ to: agentPlace({ sessionId, agentId: agent.id }) })}
        >
          {linkLabel ?? 'Open agent'}
        </Button>
      )}
    </li>
  );
};

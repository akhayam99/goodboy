import type { Agent, SessionId } from '@goodboy/types';
import { Button, Chip, StatusDot } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { agentPlace } from '../../../../store/slices/navigation/place';
import { modelLabel } from '../../../chat/utils/chat-constants';

type Props = {
  readonly sessionId: SessionId;
  readonly agent: Agent;
  readonly isRunning: boolean;
  readonly activity: string;
};

export const AnalysisHeader = ({ sessionId, agent, isRunning, activity }: Props) => {
  const navigate = useAppStore((state) => state.navigate);
  const isFailed = agent.status === 'failed' && !isRunning;
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-lg border border-border-soft bg-subtle p-3">
      <StatusDot
        tone={isRunning ? 'warning' : isFailed ? 'danger' : 'success'}
        pulsing={isRunning}
        size="sm"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-row text-foreground">{agent.name}</span>
          {agent.modelOverride === undefined ? null : (
            <Chip tone="neutral" label={modelLabel(agent.modelOverride, agent.providerOverride)} />
          )}
        </div>
        <p role="status" className="truncate text-meta text-muted-foreground">
          {isRunning ? `Running · ${activity}` : isFailed ? 'Failed' : 'Done'}
        </p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        aria-label={`Transcript of ${agent.name}`}
        onClick={() => navigate({ to: agentPlace({ sessionId, agentId: agent.id }) })}
      >
        Transcript
      </Button>
    </div>
  );
};

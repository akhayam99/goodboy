import type { Agent } from '@goodboy/types';
import { Chip, StatusDot } from '@goodboy/ui';
import type { CiFixOutcome } from '../../checks/ciFixOutcomeOf';
import { modelLabel } from '../../../chat/utils/chat-constants';

type Props = {
  readonly agent: Agent;
  readonly isRunning: boolean;
  readonly activity: string;
  readonly outcome: CiFixOutcome | null;
};

export const AnalysisHeader = ({ agent, isRunning, activity, outcome }: Props) => {
  const isFailed = agent.status === 'failed' && !isRunning;
  return (
    <div className="flex min-w-0 flex-col gap-3">
      {outcome === null ? null : (
        <div role="status" className="flex min-w-0 items-start gap-3">
          <span className="flex h-5 shrink-0 items-center">
            <StatusDot tone={outcome.tone} pulsing={outcome.isPulsing} size="md" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            {outcome.headline === null ? null : (
              <p className="text-heading text-foreground">{outcome.headline}</p>
            )}
            <p className="text-body text-muted-foreground">{outcome.detail}</p>
          </div>
        </div>
      )}
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 truncate text-row text-foreground">{agent.name}</span>
          {agent.modelOverride === undefined ? null : (
            <Chip tone="neutral" label={modelLabel(agent.modelOverride, agent.providerOverride)} />
          )}
        </div>
        {isRunning || isFailed ? (
          <p role="status" className="truncate text-meta text-muted-foreground">
            {isRunning ? `Running · ${activity}` : 'Failed'}
          </p>
        ) : null}
      </div>
    </div>
  );
};

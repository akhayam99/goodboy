import type { Agent } from '@goodboy/types';
import { AgentLastUpdate } from '../../../../shared/components/AgentLastUpdate';
import { RoutingBadge } from '../../../../shared/components/RoutingBadge';

type Props = {
  readonly agent: Agent;
  readonly provider: string | null;
  readonly model: string | null;
  readonly turns: number;
  readonly turnsLoading: boolean;
};

export const ResolverCardMetrics = ({ agent, provider, model, turns, turnsLoading }: Props) => (
  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-2xs text-muted-foreground/70">
    <RoutingBadge provider={provider} model={model} missingLabel="no model yet" />
    {!turnsLoading && (
      <span className="tabular-nums" title={`${turns} turn${turns === 1 ? '' : 's'}`}>
        {turns}t
      </span>
    )}
    <AgentLastUpdate agent={agent} />
  </div>
);

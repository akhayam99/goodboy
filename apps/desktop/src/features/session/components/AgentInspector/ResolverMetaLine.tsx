import type { Agent } from '@goodboy/types';
import type { AgentAggregate } from '../AgentMetrics';
import { AgentDuration } from '../AgentMetrics/AgentDuration';
import { formatCost, shortModel } from '../../agent-row-format';
import {
  ContextWindowBar,
  type ProviderContextUsage,
} from '../../../workspace/components/WorkspacesSidebar/parts/ContextWindowBar';

type Props = {
  readonly agent: Agent;
  readonly model: string | null;
  readonly aggregate: AgentAggregate | null;
  readonly contextUsage: ReadonlyArray<ProviderContextUsage>;
  readonly turns: number;
  readonly isWorking: boolean;
};

const SEPARATOR = <span className="text-muted-foreground/40">·</span>;

export const ResolverMetaLine = ({
  agent,
  model,
  aggregate,
  contextUsage,
  turns,
  isWorking,
}: Props) => {
  const turnCount = aggregate?.turns ?? turns;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-1.5 text-2xs tabular-nums text-muted-foreground">
        {model !== null && (
          <>
            <span>{shortModel(model)}</span>
            {SEPARATOR}
          </>
        )}
        <span>{formatCost(aggregate?.estimatedCostUsd ?? 0)}</span>
        {SEPARATOR}
        <span>
          {turnCount} {turnCount === 1 ? 'turn' : 'turns'}
        </span>
        {SEPARATOR}
        <AgentDuration run={agent} />
      </div>
      {isWorking && <ContextWindowBar usage={contextUsage} />}
    </div>
  );
};

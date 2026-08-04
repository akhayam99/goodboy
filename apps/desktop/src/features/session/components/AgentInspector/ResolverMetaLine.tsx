import type { Agent } from '@goodboy/types';
import { MetaRow } from '@goodboy/ui';
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
      <MetaRow
        className="tabular-nums"
        items={[
          model !== null ? <span key="model">{shortModel(model)}</span> : null,
          <span key="cost">{formatCost(aggregate?.estimatedCostUsd ?? 0)}</span>,
          <span key="turns">
            {turnCount} {turnCount === 1 ? 'turn' : 'turns'}
          </span>,
          <AgentDuration key="duration" run={agent} />,
        ]}
      />
      {isWorking && <ContextWindowBar usage={contextUsage} />}
    </div>
  );
};

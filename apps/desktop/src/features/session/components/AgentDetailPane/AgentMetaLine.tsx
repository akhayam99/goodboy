import { MetaRow } from '@goodboy/ui';
import type { AgentAggregate } from '../AgentMetrics';
import { formatCost, formatTokens } from '../../agent-row-format';
import { AgentMetric } from './AgentMetric';
import {
  ContextWindowBar,
  type ProviderContextUsage,
} from '../../../workspace/components/WorkspacesSidebar/parts/ContextWindowBar';

type Props = {
  readonly aggregate: AgentAggregate | null;
  readonly contextUsage: ReadonlyArray<ProviderContextUsage>;
  readonly turns: number;
};

export const AgentMetaLine = ({ aggregate, contextUsage, turns }: Props) => (
  <div className="flex flex-col gap-1">
    <MetaRow
      className="tabular-nums"
      items={[
        <AgentMetric
          key="cost"
          label="cost"
          value={formatCost(aggregate?.estimatedCostUsd ?? 0)}
        />,
        <AgentMetric key="turns" label="turns" value={String(aggregate?.turns ?? turns)} />,
        <AgentMetric key="input" label="in" value={formatTokens(aggregate?.inputTokens ?? 0)} />,
        <AgentMetric key="output" label="out" value={formatTokens(aggregate?.outputTokens ?? 0)} />,
      ]}
    />
    <ContextWindowBar usage={contextUsage} />
  </div>
);

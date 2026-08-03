import { SectionHeader, StatCard } from '@goodboy/ui';
import type { AgentAggregate } from '../AgentMetrics';
import { formatCost, formatTokens } from '../../agent-row-format';
import {
  ContextWindowBar,
  type ProviderContextUsage,
} from '../../../workspace/components/WorkspacesSidebar/parts/ContextWindowBar';

type Props = {
  readonly aggregate: AgentAggregate | null;
  readonly contextUsage: ReadonlyArray<ProviderContextUsage>;
  readonly turns: number;
};

export const CostsSection = ({ aggregate, contextUsage, turns }: Props) => (
  <section className="flex flex-col gap-2">
    <SectionHeader label="Cost" />
    <div className="grid grid-cols-2 gap-2">
      <StatCard label="Cost" value={formatCost(aggregate?.estimatedCostUsd ?? 0)} valueSize="lg" />
      <StatCard label="Turns" value={String(aggregate?.turns ?? turns)} valueSize="lg" />
      <StatCard label="Input" value={formatTokens(aggregate?.inputTokens ?? 0)} valueSize="lg" />
      <StatCard label="Output" value={formatTokens(aggregate?.outputTokens ?? 0)} valueSize="lg" />
    </div>
    <ContextWindowBar usage={contextUsage} />
  </section>
);

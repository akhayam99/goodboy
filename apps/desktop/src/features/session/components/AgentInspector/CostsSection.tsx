import type { AgentAggregate } from '../AgentMetrics';
import { formatCost, formatTokens } from '../../agent-row-format';
import {
  ContextWindowBar,
  type ProviderContextUsage,
} from '../../../workspace/components/WorkspacesSidebar/parts/ContextWindowBar';
import { InspectorSection } from '../InspectorSection';

type Props = {
  readonly aggregate: AgentAggregate | null;
  readonly contextUsage: ReadonlyArray<ProviderContextUsage>;
  readonly turns: number;
};

export const CostsSection = ({ aggregate, contextUsage, turns }: Props) => (
  <InspectorSection question="What it costs">
    <dl className="grid grid-cols-2 gap-2">
      <div className="flex flex-col gap-0.5 rounded-lg bg-muted/40 p-2">
        <dt className="text-[9px] uppercase tracking-wide text-muted-foreground/60">Cost</dt>
        <dd className="font-mono text-xs text-foreground">
          {formatCost(aggregate?.estimatedCostUsd ?? 0)}
        </dd>
      </div>
      <div className="flex flex-col gap-0.5 rounded-lg bg-muted/40 p-2">
        <dt className="text-[9px] uppercase tracking-wide text-muted-foreground/60">Turns</dt>
        <dd className="font-mono text-xs text-foreground">{aggregate?.turns ?? turns}</dd>
      </div>
      <div className="flex flex-col gap-0.5 rounded-lg bg-muted/40 p-2">
        <dt className="text-[9px] uppercase tracking-wide text-muted-foreground/60">Input</dt>
        <dd className="font-mono text-xs text-foreground">
          {formatTokens(aggregate?.inputTokens ?? 0)}
        </dd>
      </div>
      <div className="flex flex-col gap-0.5 rounded-lg bg-muted/40 p-2">
        <dt className="text-[9px] uppercase tracking-wide text-muted-foreground/60">Output</dt>
        <dd className="font-mono text-xs text-foreground">
          {formatTokens(aggregate?.outputTokens ?? 0)}
        </dd>
      </div>
    </dl>
    <ContextWindowBar usage={contextUsage} />
  </InspectorSection>
);

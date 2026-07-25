import type { Agent } from '@goodboy/types';
import { formatTokens } from '../../agent-row-format';
import { AgentDuration } from './AgentDuration';

export type AgentAggregate = {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly estimatedCostUsd: number;
  readonly turns: number;
};

type Props = {
  readonly run: Agent;
  readonly aggregate: AgentAggregate | null;
};

export const AgentMetricsBlock = ({ run, aggregate }: Props) => {
  const inputTokens = aggregate?.inputTokens ?? 0;
  const outputTokens = aggregate?.outputTokens ?? 0;

  if (inputTokens === 0 && outputTokens === 0 && run.startedAt == null) {
    return null;
  }

  return (
    <div
      data-testid="agent-metrics-block"
      className="flex items-center gap-1.5 whitespace-nowrap text-2xs text-muted-foreground/55"
    >
      <span
        className="inline-flex items-baseline gap-0.5 tabular-nums"
        title={`in: ${inputTokens.toLocaleString()} tokens (cumulative)`}
      >
        <span aria-hidden className="text-muted-foreground/40">
          ↓
        </span>
        {formatTokens(inputTokens)}
      </span>
      <span
        className="inline-flex items-baseline gap-0.5 tabular-nums"
        title={`out: ${outputTokens.toLocaleString()} tokens (cumulative)`}
      >
        <span aria-hidden className="text-muted-foreground/40">
          ↑
        </span>
        {formatTokens(outputTokens)}
      </span>
      <span aria-hidden className="text-muted-foreground/30">
        ·
      </span>
      <AgentDuration run={run} />
    </div>
  );
};

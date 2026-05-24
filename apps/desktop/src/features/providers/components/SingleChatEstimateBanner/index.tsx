import { useMemo } from 'react';
import { counterfactualCost, type TurnTelemetry } from '@goodboy/core';
import type { AgentId } from '@goodboy/types';
import { useAppStore } from '../../../../store';

const formatCost = (usd: number): string => `$${usd.toFixed(4)}`;
const formatTokens = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return `${n}`;
};

const EMPTY_TELEMETRY: ReadonlyArray<never> = [];

// Always-on banner that surfaces the counterfactual: "if all turns of this
// session had run in one ballooning chat, you'd have spent X". Same compact
// one-liner styling as the summarizer-spent banner so the two read as a pair
// when both render. Renders null when the session has <2 attributed agents
// or the delta is structurally zero — keeps it out of the way for trivial
// chats and avoids the "0 saved" noise.
export function SingleChatEstimateBanner() {
  const currentSessionId = useAppStore((s) => s.currentSessionId);
  const sessionTelemetry = useAppStore((s) =>
    currentSessionId ? (s.sessionTelemetry[currentSessionId] ?? EMPTY_TELEMETRY) : EMPTY_TELEMETRY,
  );

  const { counterfactual, distinctAgents } = useMemo(() => {
    const turns: TurnTelemetry[] = sessionTelemetry.map((r) => ({
      agentId: ((r as { agentId: AgentId | null }).agentId ?? null) as AgentId | null,
      provider: r.provider as TurnTelemetry['provider'],
      model: r.model,
      inputTokens: r.inputTokens,
      outputTokens: r.outputTokens,
      cachedInputTokens: (r as { cachedInputTokens?: number }).cachedInputTokens ?? 0,
      cacheCreation5mTokens: (r as { cacheCreation5mTokens?: number }).cacheCreation5mTokens ?? 0,
      cacheCreation1hTokens: (r as { cacheCreation1hTokens?: number }).cacheCreation1hTokens ?? 0,
      estimatedCostUsd: r.estimatedCostUsd,
      completedAt: r.recordedAt as TurnTelemetry['completedAt'],
      kind: r.kind,
    }));
    const ids = new Set<string>();
    for (const t of turns) if (t.agentId !== null) ids.add(t.agentId);
    return { counterfactual: counterfactualCost(turns), distinctAgents: ids.size };
  }, [sessionTelemetry]);

  if (distinctAgents < 2) return null;
  if (counterfactual.counterfactualCostUsd <= counterfactual.realCostUsd + 0.0001) {
    return null;
  }

  return (
    <div
      className="rounded-md bg-subtle px-3 py-2 text-xs text-muted-foreground"
      title={`You split this session across ${distinctAgents} agents. If all turns had run in one chat, the carry-forward context (~${formatTokens(
        counterfactual.extraInputTokensTotal,
      )} tokens) would have been re-priced through every later turn. Cache-hit-rate assumption: 90%.`}
    >
      <span className="font-medium text-foreground">
        {formatCost(counterfactual.counterfactualCostUsd)}
      </span>{' '}
      would have been spent running this session in a single chat (
      <span className="font-mono">{distinctAgents} agents</span>)
    </div>
  );
}

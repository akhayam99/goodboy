import { AnchoredPopover, useDropdown } from '@goodboy/ui';
import { contextTokensForUsage } from '@goodboy/core';
import { usageFigures } from '../../../chat/utils/usageFigures';
import { USAGE_CARD_MAX_WIDTH } from '../../../chat/utils/usageCardMaxWidth';
import { TurnFooterDetail } from '../../../chat/components/TurnFooter/TurnFooterDetail';
import { UsageStatsRow } from '../../../chat/components/TurnFooter/UsageStatsRow';
import type { TurnFooterData } from '../../../chat/components/TurnFooter/useTurnFooter';
import type { AgentAggregate } from '../../agentAggregate';
import type { ProviderContextUsage } from '../AgentTree/ContextWindowBar';

type Props = {
  readonly aggregate: AgentAggregate | null;
  readonly contextUsage: ReadonlyArray<ProviderContextUsage>;
  readonly turns: number | null;
};

export const AgentUsageFooter = ({ aggregate, contextUsage, turns }: Props) => {
  const dropdown = useDropdown({
    align: 'end',
    width: 'w-max',
    maxWidth: USAGE_CARD_MAX_WIDTH,
    expectedHeight: 220,
    expectedWidth: 280,
  });
  const dominant = contextUsage[0] ?? null;
  const data: TurnFooterData = {
    provider: dominant?.provider ?? null,
    model: dominant?.model ?? null,
    effort: null,
    inputTokens: dominant?.inputTokens ?? aggregate?.inputTokens ?? 0,
    outputTokens: dominant?.outputTokens ?? aggregate?.outputTokens ?? 0,
    cachedInputTokens: dominant?.cachedInputTokens ?? 0,
    cacheCreationInputTokens: dominant?.cacheCreationInputTokens ?? 0,
    contextTokens: dominant?.contextTokens ?? null,
    estimatedCostUsd:
      aggregate != null && aggregate.estimatedCostUsd > 0 ? aggregate.estimatedCostUsd : null,
  };
  const { contextWindow, hasUsage } = usageFigures({ data });

  if (!hasUsage) {
    return null;
  }

  const contextTokens = contextTokensForUsage({ contextTokens: data.contextTokens ?? undefined });
  const contextPct =
    contextTokens != null && contextWindow != null && contextWindow > 0
      ? Math.min(1, contextTokens / contextWindow)
      : null;

  return (
    <AnchoredPopover
      dropdown={dropdown}
      ariaLabel="Usage detail"
      trigger={
        <button
          type="button"
          onClick={dropdown.toggle}
          aria-label="Usage detail"
          className="flex w-fit items-center gap-1 text-meta tabular-nums text-muted-foreground transition-opacity hover:opacity-80"
        >
          <UsageStatsRow data={data} contextPct={contextPct} />
        </button>
      }
    >
      <TurnFooterDetail data={data} duration={null} startedAt={null} endedAt={null} turns={turns} />
    </AnchoredPopover>
  );
};

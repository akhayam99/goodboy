import { Info } from 'lucide-react';
import {
  cn,
  formatTokens,
  formatUsd,
  useDropdown,
  WorkNode,
  type WorkNodeState,
} from '@goodboy/ui';
import { contextTokensForUsage, inputTokensForUsage } from '@goodboy/core';
import type { AgentId, IsoDateTime, SessionId } from '@goodboy/types';
import type { TranscriptItem } from '../../utils/transcript-items';
import type { TurnOutcome } from '../../utils/turnOutcome';
import { formatDuration } from '../../utils/format-duration';
import { modelLabel } from '../../utils/chat-constants';
import { contextUsageTone } from '../../../session/contextUsageTone';
import { contextWindowFor } from '../../../session/contextWindowFor';
import { ProviderIcon } from '../../../providers/components/ProviderIcon';
import { AnchoredPopover } from '@goodboy/ui';
import { TranscriptShell } from '../TranscriptShell';
import { useTurnFooter } from './useTurnFooter';
import { TurnFooterDetail } from './TurnFooterDetail';

type Props = {
  readonly item: Extract<TranscriptItem, { kind: 'usage' }>;
  readonly sessionId?: SessionId | null;
  readonly agentId?: AgentId | null;
  readonly outcome?: TurnOutcome;
  readonly startedAt?: IsoDateTime | null;
};

const NODE_STATE_FOR: Record<Exclude<TurnOutcome, 'done'>, WorkNodeState> = {
  stopped: 'stopped',
  failed: 'failed',
};

const OUTCOME_LABEL: Record<Exclude<TurnOutcome, 'done'>, string> = {
  stopped: 'Stopped',
  failed: 'Failed',
};

export const TurnFooter = ({
  item,
  sessionId = null,
  agentId = null,
  outcome = 'done',
  startedAt = null,
}: Props) => {
  const data = useTurnFooter({ sessionId, agentId, runId: item.runId, fallbackUsage: item.usage });
  const dropdown = useDropdown({ align: 'end', expectedHeight: 220, expectedWidth: 280 });
  const durationMs =
    startedAt !== null ? Math.max(0, Date.parse(item.at) - Date.parse(startedAt)) : null;
  const duration = durationMs != null ? formatDuration({ durationMs }) : null;

  if (outcome !== 'done') {
    return (
      <TranscriptShell
        tone="neutral"
        variant="leftBorder"
        className="flex w-fit items-center gap-1.5 text-2xs text-muted-foreground"
      >
        <WorkNode
          size="sm"
          state={NODE_STATE_FOR[outcome]}
          mark={{ kind: 'dot' }}
          label={OUTCOME_LABEL[outcome]}
        />
        <span>
          {OUTCOME_LABEL[outcome]}
          {duration != null ? ` after ${duration}` : ''}
        </span>
        {(data.inputTokens > 0 || data.outputTokens > 0) && (
          <span className="tabular-nums text-faint-foreground">
            {formatTokens(data.inputTokens)} in · {formatTokens(data.outputTokens)} out
          </span>
        )}
      </TranscriptShell>
    );
  }

  const totalInput = inputTokensForUsage({
    provider: data.provider ?? 'anthropic',
    inputTokens: data.inputTokens,
    cachedInputTokens: data.cachedInputTokens,
    cacheCreationInputTokens: data.cacheCreationInputTokens,
  });
  const cachedPct = totalInput > 0 ? Math.round((data.cachedInputTokens / totalInput) * 100) : null;
  const contextWindow = data.model != null ? contextWindowFor(data.model) : null;
  const contextTokens = contextTokensForUsage({ contextTokens: data.contextTokens ?? undefined });
  const contextPct =
    contextTokens != null && contextWindow != null && contextWindow > 0
      ? Math.min(1, contextTokens / contextWindow)
      : null;

  return (
    <TranscriptShell tone="neutral" variant="leftBorder" className="flex w-fit">
      <AnchoredPopover
        dropdown={dropdown}
        ariaLabel="Turn detail"
        trigger={
          <button
            type="button"
            onClick={dropdown.toggle}
            aria-label="Turn detail"
            className="flex items-center gap-1.5 text-2xs tabular-nums text-muted-foreground transition-opacity hover:opacity-80"
          >
            <ProviderIcon provider={data.provider} size={11} />
            {data.model != null && <span>{modelLabel(data.model)}</span>}
            {duration != null && <span className="text-faint-foreground">{duration}</span>}
            <span>
              {formatTokens(totalInput)} in · {formatTokens(data.outputTokens)} out
            </span>
            {cachedPct != null && <span>{cachedPct}% cached</span>}
            {data.estimatedCostUsd != null && <span>~{formatUsd(data.estimatedCostUsd)}</span>}
            {contextPct != null && (
              <span className="flex items-center gap-1">
                <span className="h-0.5 w-6 overflow-hidden rounded-full bg-muted">
                  <span
                    className={cn(
                      'block h-full rounded-full',
                      contextUsageTone({ pct: contextPct, prefix: 'bg' }),
                    )}
                    style={{ width: `${contextPct * 100}%` }}
                  />
                </span>
                <span className={contextUsageTone({ pct: contextPct, prefix: 'text' })}>
                  {Math.round(contextPct * 100)}%
                </span>
              </span>
            )}
            <Info size={11} aria-hidden />
          </button>
        }
      >
        <TurnFooterDetail
          data={data}
          totalInput={totalInput}
          cachedPct={cachedPct}
          contextWindow={contextWindow}
          duration={duration}
          startedAt={startedAt}
          endedAt={item.at}
        />
      </AnchoredPopover>
    </TranscriptShell>
  );
};

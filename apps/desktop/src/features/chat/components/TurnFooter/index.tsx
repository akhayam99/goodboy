import {
  AnchoredPopover,
  formatTokens,
  useDropdown,
  WorkNode,
  type WorkNodeState,
} from '@goodboy/ui';
import { contextTokensForUsage, inputTokensForUsage } from '@goodboy/core';
import type { AgentId, IsoDateTime, SessionId } from '@goodboy/types';
import type { TranscriptItem } from '../../utils/transcript-items';
import type { TurnOutcome } from '../../utils/turnOutcome';
import { formatDuration } from '../../utils/format-duration';
import { contextWindowFor } from '../../../session/contextWindowFor';
import { TranscriptShell } from '../TranscriptShell';
import { useTurnFooter } from './useTurnFooter';
import { TurnFooterDetail } from './TurnFooterDetail';
import { UsageStatsRow } from './UsageStatsRow';

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
        className="flex w-fit items-center gap-1.5 text-secondary text-muted-foreground"
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
            className="flex items-center gap-1.5 text-secondary tabular-nums text-muted-foreground transition-opacity hover:opacity-80"
          >
            <UsageStatsRow
              data={data}
              totalInput={totalInput}
              cachedPct={cachedPct}
              contextPct={contextPct}
              duration={duration}
            />
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

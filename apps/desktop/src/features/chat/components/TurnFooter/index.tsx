import { AnchoredPopover, useDropdown, type WorkNodeState } from '@goodboy/ui';
import type { AgentId, IsoDateTime, ProviderRunId, SessionId } from '@goodboy/types';
import type { TranscriptItem } from '../../utils/transcript-items';
import type { TurnOutcome } from '../../utils/turnOutcome';
import { formatDuration } from '../../../../shared/utils/time/formatDuration';
import { USAGE_CARD_MAX_WIDTH } from '../../utils/usageCardMaxWidth';
import { TranscriptShell } from '../TranscriptShell';
import { useTurnFooter } from './useTurnFooter';
import { TurnFooterDetail } from './TurnFooterDetail';
import { TurnFooterSummary } from './TurnFooterSummary';

type Props = {
  readonly item: Extract<TranscriptItem, { kind: 'usage' }>;
  readonly sessionId?: SessionId | null;
  readonly agentId?: AgentId | null;
  readonly outcome?: TurnOutcome;
  readonly startedAt?: IsoDateTime | null;
  readonly previousRunId?: ProviderRunId | null;
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
  previousRunId = null,
}: Props) => {
  const data = useTurnFooter({ sessionId, agentId, runId: item.runId, fallbackUsage: item.usage });
  const previous = useTurnFooter({
    sessionId,
    agentId,
    runId: previousRunId ?? item.runId,
    fallbackUsage: item.usage,
  });
  const dropdown = useDropdown({
    align: 'end',
    width: 'w-max',
    maxWidth: USAGE_CARD_MAX_WIDTH,
    expectedHeight: 220,
    expectedWidth: 280,
  });
  const durationMs =
    startedAt !== null ? Math.max(0, Date.parse(item.at) - Date.parse(startedAt)) : null;
  const duration = durationMs != null ? formatDuration({ durationMs }) : null;
  const isSpeakerRepeat =
    previousRunId !== null &&
    outcome === 'done' &&
    duration !== null &&
    data.model !== null &&
    data.provider === previous.provider &&
    data.model === previous.model;

  return (
    <TranscriptShell tone="neutral" variant="plain" className="flex w-fit">
      <AnchoredPopover
        dropdown={dropdown}
        ariaLabel="Turn detail"
        trigger={
          <button
            type="button"
            onClick={dropdown.toggle}
            aria-label="Turn detail"
            className="flex items-center gap-1 text-meta tabular-nums text-muted-foreground transition-opacity hover:opacity-80"
          >
            <TurnFooterSummary
              data={data}
              duration={duration}
              isSpeakerShown={!isSpeakerRepeat}
              outcome={
                outcome === 'done'
                  ? null
                  : { state: NODE_STATE_FOR[outcome], label: OUTCOME_LABEL[outcome] }
              }
            />
          </button>
        }
      >
        <TurnFooterDetail
          data={data}
          duration={duration}
          startedAt={startedAt}
          endedAt={item.at}
          outcome={outcome === 'done' ? null : OUTCOME_LABEL[outcome]}
        />
      </AnchoredPopover>
    </TranscriptShell>
  );
};
